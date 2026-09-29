import { useEffect, useMemo, useState } from "react";
import type { BotSpeed } from "@labyrinth/protocol";
import { reachableSquares, reverseOf, rotate, sameSquare, shiftBoard, type BotTurn, type InsertionId, type Square, type TreasureId } from "@labyrinth/rules";
import { useTranslation } from "react-i18next";
import { Board } from "../game/Board.tsx";
import { collectedTreasures } from "../game/collected.ts";
import { GameIdBadge } from "../game/GameIdBadge.tsx";
import { DailyOver } from "../game/DailyOver.tsx";
import { ReplayControls } from "../game/ReplayControls.tsx";
import { solutionFrames, type ReplayFrame } from "../game/solutionReplay.ts";
import { dailyRecordOf } from "../session/dailyRecord.ts";
import { GameOverControls } from "../game/GameOverControls.tsx";
import { moveHint, quarterTurns, shiftHint } from "../game/hint.ts";
import { KickControl } from "../game/KickControl.tsx";
import { AutoplayButton, AutoplayPanel } from "../game/AutoplayControls.tsx";
import { LeaveButton, LeaveConfirm } from "../game/LeaveControls.tsx";
import { MoveControls } from "../game/MoveControls.tsx";
import { PlayerStrip } from "../game/PlayerStrip.tsx";
import { ShiftControls } from "../game/ShiftControls.tsx";
import { SpectatorCount, SpectatorPanel } from "../game/SpectatorControls.tsx";
import type { TargetMark } from "../game/target.ts";
import { TurnLine } from "../game/TurnLine.tsx";
import { nextTrace } from "../game/turnTrace.ts";
import { NOTICE_MS, type GameSession } from "../session/useGameSession.ts";
import type { GameView } from "../session/viewModel.ts";
import { playSound } from "../settings/feedback.ts";
import { SettingsButton, SettingsScreen } from "../settings/SettingsScreen.tsx";
import { useSettings } from "../settings/settings.ts";
import { useTurnAlert } from "../settings/turnAlert.ts";
import { FirstGameTips } from "../tips/FirstGameTips.tsx";
import { Notice } from "../ui/Notice.tsx";
import { Screen } from "../ui/Screen.tsx";

export interface GameScreenProps {
  view: GameView;
  session: Pick<
    GameSession,
    "shift" | "move" | "kick" | "leave" | "pending" | "notice" | "setSpeed" | "rematch" | "rematching" | "watchBots" | "nickname"
  > &
    // Only the daily puzzle uses these.
    Partial<Pick<GameSession, "playDaily" | "undo" | "setAutoplay">>;
}

/**
 * The game: whose turn it is, the board and the controls of the current step.
 * Shift step: tapping an edge arrow previews the shift (with the same rule the
 * server uses); tapping it again or "Työnnä" sends it. Move step: tapping a
 * highlighted square moves there at once; "Jää paikalleen" stays. The viewer's
 * target is marked wherever its tile is; a finished game shows the result with
 * "Pelaa uudelleen" and "Alkuun". A spectator gets no step controls: "Katsot peliä", the bots'
 * speed while only bots play, every player's target, and "Uusi bottipeli" after a bot-only game. Once the current player's time is up, the others get the kick
 * control instead of the (disabled) step controls, and anyone leaving is announced by nickname.
 * "Vihje" previews the bots' shift for the viewer and rings the square to walk to (move step: just
 * the square); nothing is sent, and it stays on until the viewer's turn ends.
 * The top bar's leave action asks first in a running game (in place of the controls) and leaves a
 * finished game at once.
 */
export function GameScreen({ view, session }: GameScreenProps) {
  const { t } = useTranslation();
  const { shift, move, kick, leave, pending, notice, setSpeed, setAutoplay, rematch, rematching, watchBots, nickname, playDaily, undo } = session;
  const [selected, setSelected] = useState<InsertionId>();
  const [turns, setTurns] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { confirmShift, confirmMove } = useSettings();
  // Confirm move on: the tapped square waiting for a second tap or "Kävele tänne".
  const [chosen, setChosen] = useState<Square>();
  useTurnAlert(view);

  // A new synced board (someone shifted, the turn moved) drops the preview and the local rotation.
  const boardKey = `${view.board.spare.id}|${view.lastInsertion ?? ""}|${view.turnSeat}|${view.step}`;
  const [seenKey, setSeenKey] = useState(boardKey);
  if (seenKey !== boardKey) {
    setSeenKey(boardKey);
    setSelected(undefined);
    setTurns(0);
    setChosen(undefined);
  }

  const spare = rotate(view.board.spare, turns);
  const preview = useMemo(
    () => (selected ? shiftBoard(view.board, selected, spare.rotation, view.seats.map((s) => s.square)) : undefined),
    [view.board, view.seats, selected, spare.rotation],
  );
  // Pawns on the previewed line are shown where the shift would carry them.
  const seats = preview ? view.seats.map((s, i) => ({ ...s, square: preview.pawns[i]! })) : view.seats;
  // The viewer's reach on the previewed board, from where the preview carries their pawn.
  const myIndex = view.seats.findIndex((s) => s.isMe);
  const reach = useMemo(
    () => (preview && myIndex >= 0 ? reachableSquares(preview.board, preview.pawns[myIndex]!) : undefined),
    [preview, myIndex],
  );
  // What the last turn did (pushed-in tile, walked route), kept until the next shift.
  const [trace, setTrace] = useState(() => nextTrace(undefined, view));
  const nextTraced = nextTrace(trace, view);
  if (nextTraced !== trace) setTrace(nextTraced);
  const forbidden = view.lastInsertion ? reverseOf(view.lastInsertion) : undefined;
  const shifting = view.isMyTurn && view.step === "shift";
  const canAct = shifting && !pending;

  // Hint: once asked for, it stays on for the rest of the viewer's turn (the move step follows by itself).
  // A solo puzzle player is always on turn, so a new turn number ends it too.
  const [hinted, setHinted] = useState(false);
  const [hintedTurn, setHintedTurn] = useState(view.turn);
  const [shiftHinted, setShiftHinted] = useState<BotTurn>();
  const [moveHinted, setMoveHinted] = useState<{ key: string; to?: Square }>();
  if ((!view.isMyTurn || hintedTurn !== view.turn) && (hinted || shiftHinted || moveHinted)) {
    setHinted(false);
    setShiftHinted(undefined);
    setMoveHinted(undefined);
  }
  if (hinted && view.isMyTurn && view.step === "move" && moveHinted?.key !== boardKey) {
    setMoveHinted({ key: boardKey, to: moveHint(view, shiftHinted) });
  }
  const showHint = () => {
    if (!view.isMyTurn || pending) return;
    setHinted(true);
    setHintedTurn(view.turn);
    if (view.step !== "shift") return;
    const turn = shiftHint(view);
    if (!turn) return;
    setShiftHinted(turn);
    setSelected(turn.insertion);
    setTurns(quarterTurns(view.board.spare.rotation, turn.rotation));
  };
  // The ring shows where to walk: after the hinted shift while it is previewed, or on the move step.
  const hintSquare = pending
    ? undefined
    : shifting
      ? shiftHinted && selected === shiftHinted.insertion && spare.rotation === shiftHinted.rotation
        ? shiftHinted.to
        : undefined
      : moveHinted?.key === boardKey
        ? moveHinted.to
        : undefined;

  const confirm = async (insertion: InsertionId) => {
    const result = await shift(insertion, spare.rotation);
    // Accepted: the preview stays until the synced board replaces it (they are the same board).
    if (result && !result.ok) setSelected(undefined);
  };

  const select = (insertion: InsertionId) => {
    if (!canAct || insertion === forbidden) return;
    if (insertion === selected || !confirmShift) void confirm(insertion);
    else setSelected(insertion);
  };

  const moveTo = (target: Square) => {
    if (!pending) void move(target);
  };
  const choose = (target: Square) => {
    if (!confirmMove || (chosen && sameSquare(chosen, target))) moveTo(target);
    else if (!pending) setChosen(target);
  };
  const me = view.seats.find((s) => s.isMe);

  // The best route's replay on a solved puzzle: the board shows its frames instead; nothing is sent.
  const [replay, setReplay] = useState<{ frames: ReplayFrame[]; index: number }>();
  const openReplay = () => {
    const record = dailyRecordOf(view.roomId);
    if (record && me) setReplay({ frames: solutionFrames(record.date, me.name), index: 0 });
  };
  const frame = view.finished ? replay?.frames[replay.index] : undefined;
  const stepReplay = (by: number) =>
    setReplay((r) => r && { ...r, index: Math.min(r.frames.length - 1, Math.max(0, r.index + by)) });
  const target: TargetMark | undefined =
    view.targetTileId === undefined ? undefined : { tileId: view.targetTileId, home: view.targetHome };

  // Announce the viewer's own collected treasure (derived from their growing found list).
  const found = me?.found ?? [];
  const [seenFound, setSeenFound] = useState(found.length);
  const [collected, setCollected] = useState<TreasureId>();
  if (seenFound !== found.length) {
    setSeenFound(found.length);
    if (found.length > seenFound) setCollected(found.at(-1));
  }
  useEffect(() => {
    if (!collected) return;
    playSound("treasure");
    const timer = setTimeout(() => setCollected(undefined), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [collected]);
  // Announce a player leaving the running game (left, kicked or timed out; the reason is not synced).
  // Their name is gone from the state with them, so the last seen seat → name map is kept.
  const seatList = view.seats.map((s) => `${s.seat}:${s.name}`).join(",");
  const [seenSeats, setSeenSeats] = useState({ list: seatList, seats: view.seats, finished: view.finished });
  const [departed, setDeparted] = useState<string>();
  if (seenSeats.list !== seatList || seenSeats.finished !== view.finished) {
    const gone = seenSeats.seats.find((old) => !view.seats.some((s) => s.seat === old.seat));
    if (gone !== undefined && !seenSeats.finished) setDeparted(gone.name);
    setSeenSeats({ list: seatList, seats: view.seats, finished: view.finished });
  }
  useEffect(() => {
    if (departed === undefined) return;
    const timer = setTimeout(() => setDeparted(undefined), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [departed]);

  const message = notice
    ? t(notice)
    : collected
      ? t("progress.collected", { name: t(`treasures.${collected}`) })
      : departed !== undefined
        ? t("progress.left", { name: departed })
        : undefined;

  // Settings (and the language) open over the game; the game keeps running underneath.
  if (settingsOpen) return <SettingsScreen roomId={view.roomId} onClose={() => setSettingsOpen(false)} />;

  return (
    <Screen
      start={<GameIdBadge roomId={view.roomId} />}
      end={
        <>
          <SpectatorCount count={view.spectators} />
          {setAutoplay && view.canAutoplay && !view.myAutoplay && <AutoplayButton disabled={pending} onClick={() => void setAutoplay(true)} />}
          <LeaveButton onClick={view.finished || view.spectating || view.daily ? leave : () => setLeaving(true)} />
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </>
      }
    >
      <TurnLine view={view} />
      <PlayerStrip view={view} />
      <Board
        board={frame?.board ?? preview?.board ?? view.board}
        seats={frame ? view.seats.map((s) => (s.isMe ? { ...s, square: frame.pawn } : s)) : seats}
        highlightTileId={preview ? spare.id : undefined}
        target={frame ? { tileId: frame.targetTileId, home: false } : target}
        trace={
          frame && me
            ? { shiftKey: "replay", seat: me.seat, insertion: frame.insertion, route: frame.route }
            : preview
              ? undefined
              : nextTraced
        }
        reach={reach}
        hint={hintSquare}
        shiftTargets={shifting ? { selected, forbidden, busy: pending, onSelect: select } : undefined}
        moveTargets={view.reachable ? { reachable: view.reachable, busy: pending, selected: chosen, onSelect: choose } : undefined}
      />
      {view.finished ? (
        view.spectating ? (
          <GameOverControls
            onHome={leave}
            onNewBotGame={
              view.botOnly && view.seats.length >= 2
                ? () => watchBots(nickname(), view.seats.length, view.botSpeed as BotSpeed)
                : undefined
            }
          />
        ) : view.daily && frame && replay ? (
          <ReplayControls
            index={replay.index}
            count={replay.frames.length}
            frame={frame}
            onPrev={() => stepReplay(-1)}
            onNext={() => stepReplay(1)}
            onClose={() => setReplay(undefined)}
          />
        ) : view.daily ? (
          <DailyOver onHome={leave} onRetry={() => playDaily?.(nickname())} onReplay={openReplay} />
        ) : (
          <GameOverControls onHome={leave} onRematch={rematch} rematching={rematching} />
        )
      ) : view.spectating ? (
        <SpectatorPanel botOnly={view.botOnly} speed={view.botSpeed} pending={pending} onSpeed={(speed) => void setSpeed(speed)} />
      ) : leaving ? (
        <LeaveConfirm onLeave={leave} onCancel={() => setLeaving(false)} />
      ) : view.canKick ? (
        <KickControl
          key={boardKey}
          seat={view.turnSeat}
          name={view.seats.find((s) => s.seat === view.turnSeat)?.name ?? ""}
          pending={pending}
          onKick={() => void kick(view.turnSeat)}
        />
      ) : view.myAutoplay ? (
        <AutoplayPanel pending={pending} onTakeBack={() => void setAutoplay?.(false)} />
      ) : view.step === "move" ? (
        <MoveControls
          spare={view.board.spare}
          collected={collectedTreasures(view.seats)}
          target={target}
          enabled={view.isMyTurn}
          pending={pending}
          onStay={() => me && moveTo(me.square)}
          chosen={chosen !== undefined}
          onGo={() => chosen && moveTo(chosen)}
          onCancelChoice={() => setChosen(undefined)}
          onHint={showHint}
          onUndo={view.daily ? () => void undo?.() : undefined}
          canUndo={view.undoable}
        />
      ) : (
        <ShiftControls
          spare={spare}
          collected={collectedTreasures(view.seats)}
          outgoing={preview?.pushedOut}
          target={target}
          enabled={view.isMyTurn}
          pending={pending}
          onRotate={() => setTurns((n) => n + 1)}
          onHint={showHint}
          onUndo={view.daily ? () => void undo?.() : undefined}
          canUndo={view.undoable && !preview}
          onConfirm={() => selected && void confirm(selected)}
          onCancel={() => setSelected(undefined)}
        />
      )}
      <Notice message={message} />
      <FirstGameTips
        playing={!view.spectating && view.phase === "playing" && !view.finished}
        isMyTurn={view.isMyTurn}
        step={view.step}
        heading={view.myTarget === undefined ? undefined : view.myTarget === "home" ? "home" : "treasure"}
      />
    </Screen>
  );
}

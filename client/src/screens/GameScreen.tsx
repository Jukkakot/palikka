import { useEffect, useMemo, useState } from "react";
import type { BotSpeed } from "@palikka/protocol";
import { freeCorners, type Bits, type MoveRefusal } from "@palikka/rules";
import { useTranslation } from "react-i18next";
import { AutoplayButton, AutoplayPanel } from "../game/AutoplayControls.tsx";
import { Board } from "../game/Board.tsx";
import { GameIdBadge } from "../game/GameIdBadge.tsx";
import { GameOverControls } from "../game/GameOverControls.tsx";
import { KickControl } from "../game/KickControl.tsx";
import { LeaveButton, LeaveConfirm } from "../game/LeaveControls.tsx";
import { PieceTray } from "../game/PieceTray.tsx";
import { PlaceControls } from "../game/PlaceControls.tsx";
import { PlayerStrip } from "../game/PlayerStrip.tsx";
import { ResultTable } from "../game/ResultTable.tsx";
import { SpectatorCount, SpectatorPanel } from "../game/SpectatorControls.tsx";
import { TurnLine } from "../game/TurnLine.tsx";
import { usePlacement } from "../game/usePlacement.ts";
import { NOTICE_MS, type GameSession } from "../session/useGameSession.ts";
import type { GameView } from "../session/viewModel.ts";
import { SettingsButton, SettingsScreen } from "../settings/SettingsScreen.tsx";
import { useTurnAlert } from "../settings/turnAlert.ts";
import { FirstGameTips } from "../tips/FirstGameTips.tsx";
import { Notice } from "../ui/Notice.tsx";
import { Screen } from "../ui/Screen.tsx";
import styles from "./GameScreen.module.css";

export interface GameScreenProps {
  view: GameView;
  session: Pick<GameSession, "place" | "kick" | "leave" | "pending" | "notice" | "setSpeed" | "rematch" | "rematching" | "watchBots" | "nickname"> &
    // Only some games use these.
    Partial<Pick<GameSession, "undo" | "setAutoplay">>;
}

/** The refusals a placement check gives; anything else reads as a plain "cannot go there". */
const PLACEMENT_REFUSALS = ["PIECE_USED", "OFF_BOARD", "OVERLAP", "EDGE_CONTACT", "NOT_ON_START", "NO_CORNER_CONTACT", "INVALID_MOVE"] as const;
type PlacementRefusal = (typeof PLACEMENT_REFUSALS)[number];
const refusalKey = (reason: MoveRefusal | undefined) =>
  `errors.${(PLACEMENT_REFUSALS as readonly string[]).includes(reason ?? "") ? (reason as PlacementRefusal) : "INVALID_MOVE"}` as const;

/** The board indexes of a bit set. */
function squaresOfBits(bits: Bits, size: number): Set<number> {
  const squares = new Set<number>();
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if ((bits[r]! >>> c) & 1) squares.add(r * size + c);
  return squares;
}

/**
 * The game: whose turn it is, the players and their scores, the board, the controls and the piece
 * tray. On the viewer's turn they choose a piece in the tray, turn and mirror it ("Käännä", "Peilaa",
 * R, F), aim it on the board (hover, tap or arrow keys; a pointer snaps to a legal spot) and place a
 * legal preview with a second tap, a click, Enter or "Aseta". "Vihje" puts the bot's move in the
 * preview. Against bots on the device "Peru" takes back the viewer's last move. A finished game shows
 * the result table with "Pelaa uudelleen" and "Alkuun". A spectator gets no turn controls: the bots' speed
 * while only bots play, and "Uusi bottipeli" after a bot-only game. Once the current player's time is
 * up, the others get the kick control, and anyone leaving is announced by nickname. The top bar's
 * leave action asks first in a running game (in place of the controls) and leaves a finished game at
 * once.
 */
export function GameScreen({ view, session }: GameScreenProps) {
  const { t } = useTranslation();
  const { place, kick, leave, pending, notice, setSpeed, setAutoplay, rematch, rematching, watchBots, nickname, undo } = session;
  const [leaving, setLeaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useTurnAlert(view);

  const placing = usePlacement(view);
  const { position, isMyTurn, mySeat } = view;
  // The colour the viewer places and sees in the tray (the one on turn when it is theirs).
  const colour = view.trayColour ?? mySeat;
  const corners = useMemo(
    () => (isMyTurn && position && colour !== undefined ? squaresOfBits(freeCorners(position, colour), position.config.size) : undefined),
    [isMyTurn, position, colour],
  );
  const preview = placing.preview;
  const boardPreview = useMemo(
    () => (preview && colour !== undefined ? { squares: new Set(preview.squares), legal: preview.legal, seat: colour } : undefined),
    [preview, colour],
  );

  const send = async (move: Parameters<typeof place>[0] | undefined) => {
    if (!move || pending) return;
    const result = await place(move);
    if (result?.ok) placing.clear();
  };

  // R, F and Escape while choosing (not while typing somewhere).
  const { active, chosen, turn: turnPiece, mirror, clear } = placing;
  useEffect(() => {
    if (!active || chosen === undefined) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest("input, textarea, select") !== null;
      if (e.ctrlKey || e.metaKey || e.altKey || typing) return;
      const key = e.key.toLowerCase();
      if (key === "r") turnPiece();
      else if (key === "f") mirror();
      else if (key === "escape") clear();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, chosen, turnPiece, mirror, clear]);

  let status: string;
  if (!isMyTurn) status = t("place.wait");
  else if (!chosen) status = t("place.choose");
  else if (!preview) status = t("place.aim");
  else if (preview.legal) status = t("place.ready");
  else status = t(refusalKey(preview.reason));
  const announce = preview
    ? t(preview.legal ? "place.announceOk" : "place.announceBad", {
        row: preview.move.row + 1,
        col: preview.move.col + 1,
        reason: preview.legal ? "" : t(refusalKey(preview.reason)),
      })
    : undefined;

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

  const message = notice ? t(notice) : departed !== undefined ? t("progress.left", { name: departed }) : undefined;

  // Settings (and the language) open over the game; the game keeps running underneath.
  if (settingsOpen) return <SettingsScreen roomId={view.roomId} onClose={() => setSettingsOpen(false)} />;

  return (
    <Screen
      start={<GameIdBadge roomId={view.roomId} />}
      end={
        <>
          <SpectatorCount count={view.spectators} />
          {setAutoplay && view.canAutoplay && !view.myAutoplay && <AutoplayButton disabled={pending} onClick={() => void setAutoplay(true)} />}
          <LeaveButton onClick={view.finished || view.spectating ? leave : () => setLeaving(true)} />
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </>
      }
    >
      <div className={styles.layout}>
        <div className={styles.head}>
          <TurnLine view={view} />
          <PlayerStrip view={view} />
        </div>
        <div className={styles.board}>
          <Board
            board={view.board}
            corners={corners}
            preview={boardPreview}
            busy={pending}
            onPoint={placing.active ? placing.point : undefined}
            onSquare={placing.active && chosen ? (square) => void send(placing.click(square)) : undefined}
            onMove={placing.moveBy}
            onConfirm={() => void send(placing.ready)}
            announce={announce}
          />
        </div>
        <div className={styles.side}>
          {view.finished && view.results.length > 0 && <ResultTable rows={view.results} />}
          {view.finished ? (
            view.spectating ? (
              <GameOverControls
                onHome={leave}
                onNewBotGame={
                  view.botOnly && view.seats.length >= 2
                    ? () => watchBots(nickname(), view.seats.length, view.botSpeed as BotSpeed, view.variant)
                    : undefined
                }
              />
            ) : (
              <GameOverControls onHome={leave} onRematch={rematch} rematching={rematching} />
            )
          ) : view.spectating ? (
            <SpectatorPanel botOnly={view.botOnly} speed={view.botSpeed} pending={pending} onSpeed={(speed) => void setSpeed(speed)} />
          ) : leaving ? (
            <LeaveConfirm onLeave={leave} onCancel={() => setLeaving(false)} />
          ) : view.canKick ? (
            <KickControl
              key={view.turn}
              seat={view.turnSeat}
              name={view.seats.find((s) => s.seat === view.turnSeat)?.name ?? ""}
              pending={pending}
              onKick={() => void kick(view.turnSeat)}
            />
          ) : view.myAutoplay ? (
            <AutoplayPanel pending={pending} onTakeBack={() => void setAutoplay?.(false)} />
          ) : (
            <PlaceControls
              enabled={isMyTurn}
              pending={pending}
              status={status}
              warning={preview !== undefined && !preview.legal}
              chosen={chosen !== undefined}
              ready={placing.ready !== undefined}
              onTurn={turnPiece}
              onMirror={mirror}
              onPlace={() => void send(placing.ready)}
              onHint={placing.hint}
              onUndo={view.canUndo ? () => void undo?.() : undefined}
              canUndo={view.undoable}
            />
          )}
          {!view.finished && !view.spectating && colour !== undefined && position && (
            <PieceTray
              seat={colour}
              placed={position.placed[colour] ?? []}
              fitting={placing.fitting}
              chosen={chosen}
              onChoose={placing.choose}
              disabled={pending || view.myAutoplay}
            />
          )}
        </div>
      </div>
      <Notice message={message} />
      <FirstGameTips playing={!view.spectating && view.phase === "playing" && !view.finished} isMyTurn={view.isMyTurn} />
    </Screen>
  );
}

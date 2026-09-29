import { useEffect, useMemo, useState } from "react";
import type { BotSpeed } from "@palikka/protocol";
import { useTranslation } from "react-i18next";
import { AutoplayButton, AutoplayPanel } from "../game/AutoplayControls.tsx";
import { Board } from "../game/Board.tsx";
import { GameIdBadge } from "../game/GameIdBadge.tsx";
import { GameOverControls } from "../game/GameOverControls.tsx";
import { hintSquares, interimMoves } from "../game/interimMoves.ts";
import { KickControl } from "../game/KickControl.tsx";
import { LeaveButton, LeaveConfirm } from "../game/LeaveControls.tsx";
import { PlaceControls } from "../game/PlaceControls.tsx";
import { PlayerStrip } from "../game/PlayerStrip.tsx";
import { SpectatorCount, SpectatorPanel } from "../game/SpectatorControls.tsx";
import { TurnLine } from "../game/TurnLine.tsx";
import { NOTICE_MS, type GameSession } from "../session/useGameSession.ts";
import type { GameView } from "../session/viewModel.ts";
import { SettingsButton, SettingsScreen } from "../settings/SettingsScreen.tsx";
import { useTurnAlert } from "../settings/turnAlert.ts";
import { FirstGameTips } from "../tips/FirstGameTips.tsx";
import { Notice } from "../ui/Notice.tsx";
import { Screen } from "../ui/Screen.tsx";

export interface GameScreenProps {
  view: GameView;
  session: Pick<GameSession, "place" | "kick" | "leave" | "pending" | "notice" | "setSpeed" | "rematch" | "rematching" | "watchBots" | "nickname"> &
    // Only some games use these.
    Partial<Pick<GameSession, "undo" | "setAutoplay">>;
}

/**
 * The game: whose turn it is, the players and their scores, the board and the controls. On the
 * viewer's turn (interim control until the piece tray) a marked corner square places the largest
 * piece that fits there with one tap. "Vihje" rings the squares the bot would cover; it stays until
 * the turn ends. Against bots on the device "Peru" takes back the viewer's last move. A finished game shows the result with "Pelaa uudelleen" and
 * "Alkuun". A spectator gets no turn controls: the bots' speed while only bots play, and "Uusi
 * bottipeli" after a bot-only game. Once the current player's time is up, the others get the kick
 * control, and anyone leaving is announced by nickname. The top bar's leave action asks first in a
 * running game (in place of the controls) and leaves a finished game at once.
 */
export function GameScreen({ view, session }: GameScreenProps) {
  const { t } = useTranslation();
  const { place, kick, leave, pending, notice, setSpeed, setAutoplay, rematch, rematching, watchBots, nickname, undo } = session;
  const [leaving, setLeaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useTurnAlert(view);

  // Hint: once asked for, it stays on for the rest of the viewer's turn.
  const [hintedTurn, setHintedTurn] = useState<number>();
  const { position, isMyTurn, mySeat, turn } = view;
  const hinted = isMyTurn && hintedTurn === turn;
  const hint = useMemo(
    () => (hinted && position && mySeat !== undefined ? new Set(hintSquares(position, mySeat, turn)) : undefined),
    [hinted, position, mySeat, turn],
  );
  // Interim move control: the viewer's tappable squares and the move each one makes.
  const moves = useMemo(
    () => (isMyTurn && position && mySeat !== undefined ? interimMoves(position, mySeat) : undefined),
    [isMyTurn, position, mySeat],
  );
  const tappable = useMemo(() => (moves ? new Set(moves.keys()) : undefined), [moves]);

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

  const onTap = (index: number) => {
    const move = moves?.get(index);
    if (move && !pending) void place(move);
  };

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
      <TurnLine view={view} />
      <PlayerStrip view={view} />
      <Board board={view.board} hint={hint} tappable={tappable} onTap={view.isMyTurn ? onTap : undefined} busy={pending} />
      {view.finished ? (
        view.spectating ? (
          <GameOverControls
            onHome={leave}
            onNewBotGame={
              view.botOnly && view.seats.length >= 2 ? () => watchBots(nickname(), view.seats.length, view.botSpeed as BotSpeed) : undefined
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
          enabled={view.isMyTurn}
          pending={pending}
          onHint={() => setHintedTurn(view.turn)}
          onUndo={view.canUndo ? () => void undo?.() : undefined}
          canUndo={view.undoable}
        />
      )}
      <Notice message={message} />
      <FirstGameTips playing={!view.spectating && view.phase === "playing" && !view.finished} isMyTurn={view.isMyTurn} />
    </Screen>
  );
}

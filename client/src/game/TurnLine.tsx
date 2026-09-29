import { useTranslation } from "react-i18next";
import type { GameView } from "../session/viewModel.ts";
import { SeatMark } from "./SeatMark.tsx";
import styles from "./TurnLine.module.css";
import { TurnTimer } from "./TurnTimer.tsx";

type TurnLineView = Pick<GameView, "turnSeat" | "isMyTurn" | "seats"> &
  Partial<Pick<GameView, "finished" | "winners" | "mySeat" | "turnDeadline" | "turnExpired" | "turnDisconnected" | "turnAutoplay">>;

/**
 * Whose turn it is, with the current player's colour; on your own turn, what to do. The turn's time
 * left follows at the end. Once the game has finished it shows the result instead: the winner, or
 * every winner of a shared win.
 */
export function TurnLine({ view }: { view: TurnLineView }) {
  const { t } = useTranslation();
  const { turnSeat, isMyTurn, finished = false, winners = [], mySeat } = view;
  const { turnDeadline = 0, turnExpired = false, turnDisconnected = false, turnAutoplay = false } = view;
  const mineSeat = turnSeat === mySeat;
  const nameOf = (seat: number) => view.seats.find((s) => s.seat === seat)?.name ?? "";
  if (finished && winners.length > 0) {
    const iWon = mySeat !== undefined && winners.includes(mySeat);
    const first = winners[0]!;
    let text: string;
    if (winners.length > 1) text = t(iWon ? "result.sharedMine" : "result.shared", { names: winners.map(nameOf).join(", ") });
    else text = iWon ? t("result.mine") : t("result.other", { name: nameOf(first) });
    return (
      <p className={`${styles.line} ${styles.mine}`} data-winner-seat={winners.join(",")}>
        <SeatMark seat={iWon ? mySeat : first} isMe={iWon} size={28} />
        <span>{text}</span>
      </p>
    );
  }
  if (turnSeat === 0) return null;
  let text: string;
  if (isMyTurn) text = t("turn.mine");
  else if (turnAutoplay && mineSeat) text = t("turn.autoplayMine");
  else if (turnDisconnected) text = t("turn.disconnected", { name: nameOf(turnSeat) });
  else if (turnAutoplay) text = t("turn.autoplay", { name: nameOf(turnSeat) });
  else text = t("turn.other", { name: nameOf(turnSeat) });
  return (
    <p className={isMyTurn ? `${styles.line} ${styles.mine}` : styles.line} data-turn-seat={turnSeat}>
      <SeatMark seat={turnSeat} isMe={mineSeat} size={28} />
      <span>{text}</span>
      <TurnTimer deadline={turnDeadline} expired={turnExpired} />
    </p>
  );
}

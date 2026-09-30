import { useTranslation } from "react-i18next";
import type { GameView } from "../session/viewModel.ts";
import { SeatMark } from "./SeatMark.tsx";
import styles from "./TurnLine.module.css";
import { TurnTimer } from "./TurnTimer.tsx";

type TurnLineView = Pick<GameView, "turnSeat" | "isMyTurn" | "seats"> &
  Partial<
    Pick<
      GameView,
      "finished" | "winners" | "mySeat" | "turnDeadline" | "turnExpired" | "turnDisconnected" | "turnAutoplay" | "turnColour" | "turnShared" | "variant"
    >
  >;

/**
 * Whose turn it is, with the colour on turn; on your own turn, what to do. In variants where a player
 * plays several colours or one is shared, the colour's name comes first ("Puolukka · Pekka miettii…",
 * "Kuusi (yhteinen) · Sinun vuorosi"). The turn's time left follows at the end. Once the game has
 * finished it shows the result instead: the winner, or every winner of a shared win.
 */
export function TurnLine({ view }: { view: TurnLineView }) {
  const { t } = useTranslation();
  const { turnSeat, isMyTurn, finished = false, winners = [], mySeat } = view;
  const { turnDeadline = 0, turnExpired = false, turnDisconnected = false, turnAutoplay = false } = view;
  const mineSeat = turnSeat === mySeat;
  const nameOf = (seat: number) => view.seats.find((s) => s.seat === seat)?.name ?? "";
  const colourOfSeat = (seat: number | undefined) => view.seats.find((s) => s.seat === seat)?.colours?.[0] ?? seat;
  const turnColour = view.turnColour || turnSeat;
  const named = view.variant === "double" || view.variant === "trio";
  if (finished && winners.length > 0) {
    const iWon = mySeat !== undefined && winners.includes(mySeat);
    const first = winners[0]!;
    let text: string;
    if (winners.length > 1) text = t(iWon ? "result.sharedMine" : "result.shared", { names: winners.map(nameOf).join(", ") });
    else text = iWon ? t("result.mine") : t("result.other", { name: nameOf(first) });
    return (
      <p className={`${styles.line} ${styles.mine}`} data-winner-seat={winners.join(",")}>
        <SeatMark seat={colourOfSeat(iWon ? mySeat : first) ?? first} isMe={iWon} size={28} />
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
  if (named) {
    const colour = t(`colour.${turnColour}` as "colour.1");
    text = t("turn.colour", { colour: view.turnShared ? t("turn.shared", { colour }) : colour, text });
  }
  return (
    <p className={isMyTurn ? `${styles.line} ${styles.mine}` : styles.line} data-turn-seat={turnSeat} data-turn-colour={turnColour}>
      <SeatMark seat={turnColour} isMe={mineSeat} size={28} />
      <span>{text}</span>
      <TurnTimer deadline={turnDeadline} expired={turnExpired} />
    </p>
  );
}

import { IconRobot, IconWifiOff, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { VARIANTS } from "@palikka/rules";
import { useTranslation } from "react-i18next";
import { GameIdBadge } from "../game/GameIdBadge.tsx";
import { SeatMark } from "../game/SeatMark.tsx";
import { VariantPicker } from "../game/VariantPicker.tsx";
import { inviteUrl } from "../session/inviteLink.ts";
import { NOTICE_MS, type GameSession } from "../session/useGameSession.ts";
import type { GameView } from "../session/viewModel.ts";
import { Button } from "../ui/Button.tsx";
import { LanguageSwitcher } from "../ui/LanguageSwitcher.tsx";
import { Notice } from "../ui/Notice.tsx";
import { Screen } from "../ui/Screen.tsx";
import { browserSharer, shareOrCopy, type Sharer } from "../ui/share.ts";
import styles from "./WaitingRoomScreen.module.css";

export interface WaitingRoomScreenProps {
  view: Pick<GameView, "roomId" | "seats" | "hostSeat" | "mySeat"> & Partial<Pick<GameView, "variant" | "maxSeats">>;
  session: Pick<GameSession, "start" | "addBot" | "removeBot" | "leave" | "pending" | "notice"> & Partial<Pick<GameSession, "setVariant">>;
  sharer?: Sharer;
}

/**
 * Before the start: the variant (the host chooses it, others see it), who is seated (colour, nickname,
 * host, "you" and bot marks) in the variant's seats, inviting others, and the host's start. The host
 * fills free seats with bots and removes them again. Guests wait for the host. Leaving is confirmed
 * only for a host with others seated, because it closes the game for them.
 */
export function WaitingRoomScreen({ view, session, sharer = browserSharer() }: WaitingRoomScreenProps) {
  const { t } = useTranslation();
  const { start, addBot, removeBot, leave, pending, notice, setVariant } = session;
  const variant = view.variant ?? "classic";
  const seatNumbers = Array.from({ length: view.maxSeats ?? 4 }, (_, i) => i + 1);
  const needed = VARIANTS[variant].minPlayers;
  // The colours each seat will play (Tuplaväri: two).
  const groups = VARIANTS[variant].colourGroups(seatNumbers);
  const marks = (seat: number, isMe = false) =>
    (groups[seat - 1] ?? [seat]).map((colour) => <SeatMark key={colour} seat={colour} isMe={isMe} size={24} />);
  const [confirming, setConfirming] = useState(false);
  const [shareNote, setShareNote] = useState<string>();
  const isHost = view.mySeat !== undefined && view.mySeat === view.hostSeat;
  const host = view.seats.find((s) => s.seat === view.hostSeat);
  const enough = view.seats.length >= needed;

  useEffect(() => {
    if (!shareNote) return;
    const timer = setTimeout(() => setShareNote(undefined), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [shareNote]);

  const invite = async () => {
    const url = inviteUrl(view.roomId);
    const outcome = await shareOrCopy(sharer, { url, text: t("waiting.shareText") }, url);
    if (outcome === "copied") setShareNote(t("waiting.copied"));
    if (outcome === "failed") setShareNote(t("waiting.copyFailed", { url }));
  };

  const askLeave = () => {
    if (isHost && view.seats.length > 1) setConfirming(true);
    else leave();
  };

  return (
    <Screen start={<GameIdBadge roomId={view.roomId} invite="join" />} end={<LanguageSwitcher />}>
      <h1 className={styles.title}>{t("waiting.title")}</h1>
      <div className={styles.variant} data-variant={variant}>
        {isHost && setVariant ? (
          <VariantPicker value={variant} onChange={(v) => void setVariant(v)} disabled={pending} />
        ) : (
          <p className={styles.hint}>{t("variant.chosen", { name: t(`variant.${variant}`) })}</p>
        )}
      </div>
      <ul className={styles.seats} aria-label={t("waiting.seats")}>
        {seatNumbers.map((seat) => {
          const s = view.seats.find((p) => p.seat === seat);
          if (!s) {
            return (
              <li key={seat} className={`${styles.seat} ${styles.free}`} data-seat={seat} data-free="">
                <span className={styles.freeMark} aria-hidden="true">
                  {marks(seat)}
                </span>
                <span>{t("waiting.freeSeat")}</span>
                {isHost && (
                  <Button
                    variant="secondary"
                    className={styles.seatAction}
                    onClick={() => void addBot(seat)}
                    disabled={pending}
                    aria-label={t("waiting.addBotLabel", { seat })}
                  >
                    <IconRobot size={18} aria-hidden="true" />
                    {t("waiting.addBot")}
                  </Button>
                )}
              </li>
            );
          }
          const badges = [s.isMe && t("waiting.you"), s.seat === view.hostSeat && t("waiting.host"), s.isBot && t("waiting.bot")].filter(Boolean);
          return (
            <li key={seat} className={[styles.seat, !s.connected && styles.offline].filter(Boolean).join(" ")} data-seat={seat}>
              {marks(seat, s.isMe)}
              {s.isBot && <IconRobot size={18} stroke={2} aria-hidden="true" className={styles.botIcon} />}
              <span className={styles.name}>{s.name}</span>
              {badges.map((m) => (
                <span key={m as string} className={styles.badge}>
                  {m}
                </span>
              ))}
              {!s.connected && (
                <>
                  <IconWifiOff size={16} stroke={2} aria-hidden="true" className={styles.offlineIcon} />
                  <span className={styles.srOnly}>{t("waiting.disconnected")}</span>
                </>
              )}
              {isHost && s.isBot && (
                <Button
                  variant="secondary"
                  className={`${styles.seatAction} ${styles.iconAction}`}
                  onClick={() => void removeBot(seat)}
                  disabled={pending}
                  aria-label={t("waiting.removeBot", { name: s.name })}
                  title={t("waiting.removeBot", { name: s.name })}
                >
                  <IconX size={20} aria-hidden="true" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <div className={styles.actions}>
        {confirming ? (
          <>
            <p className={styles.hint}>{t("waiting.leaveConfirm")}</p>
            <Button onClick={leave}>{t("waiting.leave")}</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t("waiting.cancel")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => void invite()}>
              {t("waiting.invite")}
            </Button>
            {isHost ? (
              <>
                <Button
                  onClick={() => void start()}
                  disabled={!enough || pending}
                  aria-busy={pending || undefined}
                  aria-describedby={enough ? undefined : "start-hint"}
                >
                  {pending ? t("common.waiting") : t("waiting.start")}
                </Button>
                {!enough && (
                  <p id="start-hint" className={styles.hint}>
                    {needed === 2 ? t("waiting.needTwo") : t("waiting.needPlayers", { count: needed })}
                  </p>
                )}
              </>
            ) : (
              <p className={styles.hint}>{t("waiting.waitingFor", { name: host?.name ?? "" })}</p>
            )}
            <Button variant="secondary" onClick={askLeave}>
              {t("waiting.leave")}
            </Button>
          </>
        )}
      </div>
      <Notice message={notice ? t(notice) : shareNote} />
    </Screen>
  );
}

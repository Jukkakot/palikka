import { IconDice5 } from "@tabler/icons-react";
import { RULES_VERSION } from "@palikka/rules";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isLocalToken } from "../session/localGameStore.ts";
import { checkNickname, loadNickname, randomNickname } from "../session/nickname.ts";
import type { ServerWake } from "../session/serverWake.ts";
import type { OpenGames } from "../session/useOpenGames.ts";
import type { GameSession } from "../session/useGameSession.ts";
import { SettingsButton, SettingsScreen } from "../settings/SettingsScreen.tsx";
import { TipsReset } from "../tips/TipsReset.tsx";
import { Button } from "../ui/Button.tsx";
import { HowToPlay } from "../howto/HowToPlay.tsx";
import { LanguageSwitcher } from "../ui/LanguageSwitcher.tsx";
import { LinkButton } from "../ui/LinkButton.tsx";
import { Message } from "../ui/Message.tsx";
import { Screen } from "../ui/Screen.tsx";
import { Switch } from "../ui/Switch.tsx";
import { BuildInfo } from "./BuildInfo.tsx";
import styles from "./StartScreen.module.css";

export interface StartScreenProps {
  session: Pick<
    GameSession,
    "status" | "slow" | "createGame" | "joinById" | "playBots" | "joinInvite" | "watch" | "watchBots" | "retry" | "startNotice" | "resumable" | "resume"
  >;
  /** The early server wake-up: the join actions stay disabled until it is over. */
  wake: ServerWake;
  /** The live list of open public games. */
  openGames?: OpenGames;
  /** Invite mode: the id of the game this page's link invites to. */
  invite?: string;
  /** The invite has been used or dismissed ("Muut pelit"). */
  onInviteDone?(): void;
}

const NO_GAMES: OpenGames = { status: "off", games: [], running: [] };

/** Quick games against bots: the player against 1, 2 or 3 bots. */
const BOT_COUNTS = [1, 2, 3] as const;
/** Games of bots only to watch: 2, 3 or 4 bots. */
const WATCH_COUNTS = [2, 3, 4] as const;

/** Whole seconds since `active` became true (0 while inactive), counted once a second. */
function useSecondsWaited(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const since = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - since) / 1000)), 1000);
    return () => {
      clearInterval(timer);
      setSeconds(0);
    };
  }, [active]);
  return active ? seconds : 0;
}

/** Seconds as m:ss. */
function minutesSeconds(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Before a game: the nickname field and two equal ways in, "Pelaa botteja vastaan" (a game against
 * 1–3 bots, or 2–4 bots to watch, on the device at once) and "Luo peli kavereille" (a new online game,
 * waiting for the server to wake), then the open and running games when there are any; in invite
 * mode the invite instead. Then the connecting and join-error states.
 */
export function StartScreen({ session, wake, openGames = NO_GAMES, invite, onInviteDone }: StartScreenProps) {
  const { t, i18n } = useTranslation();
  const { status, slow, createGame, joinById, playBots, joinInvite, watch, watchBots, retry, startNotice, resumable, resume } = session;
  // A new player gets a random name, so they can start at once; it is remembered only once used.
  const [input, setInput] = useState(() => loadNickname() || randomNickname(i18n.language));
  const [touched, setTouched] = useState(false);
  const nickname = checkNickname(input);
  const waited = useSecondsWaited(wake.state === "waking" && status !== "connecting" && status !== "error");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  // "Pelaan itse": on whenever the screen opens; off offers a game of bots only to watch.
  const [playMyself, setPlayMyself] = useState(true);
  if (settingsOpen) return <SettingsScreen onClose={() => setSettingsOpen(false)} />;
  if (howToOpen) return <HowToPlay onClose={() => setHowToOpen(false)} />;

  let content;
  if (status === "connecting") {
    content = (
      <Message role="status" title={t("start.connecting")}>
        {slow && <p>{t("start.slow")}</p>}
      </Message>
    );
  } else if (status === "error") {
    content = (
      <Message role="alert" title={t("start.errorTitle")} action={<Button onClick={retry}>{t("start.retry")}</Button>}>
        <p>{t("start.errorBody")}</p>
      </Message>
    );
  } else {
    const waking = wake.state === "waking";
    const disabled = waking || !nickname.ok;
    const name = nickname.ok ? nickname.nickname : "";
    const showHint = !nickname.ok && (touched || input !== "");
    const offerResume = resumable !== undefined && !invite;
    const acceptInvite = () => {
      if (!invite) return;
      joinInvite(invite, name);
      onInviteDone?.();
    };
    content = (
      <>
        <Message title={t("app.title")}>
          <p>{invite ? t("start.invited") : t("app.tagline")}</p>
          <LinkButton onClick={() => setHowToOpen(true)}>{t("howTo.open")}</LinkButton>
        </Message>

        {offerResume && (
          <section className={styles.resume} aria-labelledby="resume-title">
            <h2 id="resume-title" className={styles.resumeTitle}>
              {t("start.resumeTitle")}
            </h2>
            <p className={styles.resumeBody}>{t("start.resumeBody")}</p>
            <Button disabled={waking && !isLocalToken(resumable.token)} onClick={resume}>
              {t("start.resume")}
            </Button>
          </section>
        )}

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (disabled) return;
            if (invite) acceptInvite();
            else createGame(name);
          }}
        >
          <div className={styles.field}>
            <label htmlFor="nickname" className={styles.label}>
              {t("start.nickname")}
            </label>
            <div className={styles.inputRow}>
              <input
                id="nickname"
                className={styles.input}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onBlur={() => setTouched(true)}
                maxLength={32}
                autoComplete="nickname"
                enterKeyHint="go"
                aria-invalid={showHint || undefined}
                aria-describedby={showHint ? "nickname-hint" : undefined}
              />
              <Button
                variant="secondary"
                className={styles.dice}
                onClick={() => setInput(randomNickname(i18n.language))}
                aria-label={t("start.randomName")}
                title={t("start.randomName")}
              >
                <IconDice5 size={22} aria-hidden="true" />
              </Button>
            </div>
          </div>
          {showHint && (
            <p id="nickname-hint" className={styles.hint}>
              {t(nickname.issue === "characters" ? "start.nicknameCharacters" : "start.nicknameLength")}
            </p>
          )}
          {invite && (
            <div className={styles.actions}>
              <Button type="submit" disabled={disabled}>
                {t("start.joinInvite")}
              </Button>
              <Button variant="secondary" onClick={onInviteDone}>
                {t("start.otherGames")}
              </Button>
            </div>
          )}
        </form>

        {invite ? (
          <div role="status" className={styles.wake}>
            {startNotice && <p className={styles.ended}>{t(`start.${startNotice}`)}</p>}
            {waking && (
              <p className={styles.waking}>
                <span className={styles.spinner} aria-hidden="true" />
                {t("start.waking")}
                <span className={styles.waited} aria-hidden="true">
                  {t("start.wakingFor", { time: minutesSeconds(waited) })}
                </span>
              </p>
            )}
            {waking && wake.slow && <p>{t("start.wakingSlow")}</p>}
            {wake.state === "failed" && <p>{t("start.wakeFailed")}</p>}
          </div>
        ) : (
          <div className={styles.ways}>
            <section className={styles.way} aria-labelledby="bots-title">
              <h2 id="bots-title" className={styles.wayTitle}>
                {t("start.botsTitle")}
              </h2>
              <p className={styles.wayBody}>{t("start.botsBody")}</p>
              <label className={styles.playMyself}>
                {t("start.playMyself")}
                <Switch checked={playMyself} onChange={(e) => setPlayMyself(e.target.checked)} />
              </label>
              <div className={styles.counts}>
                {playMyself
                  ? BOT_COUNTS.map((bots) => (
                      <Button
                        key={bots}
                        variant={offerResume ? "secondary" : undefined}
                        disabled={!nickname.ok}
                        onClick={() => playBots(name, bots)}
                        aria-label={t("start.botGameLabel", { count: bots })}
                      >
                        1v{bots}
                      </Button>
                    ))
                  : WATCH_COUNTS.map((bots) => (
                      <Button
                        key={bots}
                        variant="secondary"
                        disabled={!nickname.ok}
                        onClick={() => watchBots(name, bots)}
                        aria-label={t("start.watchBotsLabel", { count: bots })}
                      >
                        {t("start.watchBotCount", { count: bots })}
                      </Button>
                    ))}
              </div>
            </section>

            <section className={styles.way} aria-labelledby="friends-title">
              <h2 id="friends-title" className={styles.wayTitle}>
                {t("start.friendsTitle")}
              </h2>
              <p className={styles.wayBody}>{t("start.friendsBody")}</p>
              <Button variant={offerResume ? "secondary" : undefined} disabled={disabled} onClick={() => createGame(name)}>
                {t("start.create")}
              </Button>
              {/* Always mounted so screen readers announce the change. */}
            <div role="status" className={styles.wake}>
              {startNotice && <p className={styles.ended}>{t(`start.${startNotice}`)}</p>}
              {waking && (
                <p className={styles.waking}>
                  <span className={styles.spinner} aria-hidden="true" />
                  {t("start.waking")}
                  <span className={styles.waited} aria-hidden="true">
                    {t("start.wakingFor", { time: minutesSeconds(waited) })}
                  </span>
                </p>
              )}
              {waking && wake.slow && <p>{t("start.wakingSlow")}</p>}
              {wake.state === "failed" && <p>{t("start.wakeFailed")}</p>}
            </div>
            </section>
          </div>
        )}

        {!invite && (openGames.games.length > 0 || openGames.running.length > 0) && (
          <section className={styles.games} aria-labelledby="join-games">
            <h2 id="join-games" className={styles.gamesTitle}>
              {t("start.joinTitle")}
            </h2>
            {openGames.games.length > 0 && (
              <>
                <h3 className={styles.listTitle}>{t("start.openGames")}</h3>
                <ul className={styles.list}>
                  {openGames.games.map((g) => (
                    <li key={g.roomId}>
                      <button
                        type="button"
                        className={styles.game}
                        disabled={disabled}
                        onClick={() => joinById(g.roomId, name)}
                        aria-label={t("start.gameEntryLabel", { host: g.host, count: g.seated })}
                        data-room={g.roomId}
                      >
                        <span className={styles.gameHost}>{g.host}</span>
                        <span className={styles.gameCount}>· {g.seated}/4</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {openGames.running.length > 0 && (
              <>
                <h3 className={styles.listTitle}>{t("start.runningGames")}</h3>
                <ul className={styles.list}>
                  {openGames.running.map((g) => (
                    <li key={g.roomId}>
                      <button
                        type="button"
                        className={styles.game}
                        disabled={disabled}
                        onClick={() => watch(g.roomId, name)}
                        aria-label={t("start.runningEntryLabel", { host: g.host, count: g.seated })}
                        data-room={g.roomId}
                      >
                        <span className={styles.gameHost}>{g.host}</span>
                        <span className={styles.gameCount}>· {t("start.runningCount", { count: g.seated })}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </>
    );
  }

  return (
    <Screen
      centered
      end={
        <>
          <SettingsButton onClick={() => setSettingsOpen(true)} />
          <LanguageSwitcher />
        </>
      }
      footer={
        <>
          <div>{t("footer.rulesVersion", { version: RULES_VERSION })}</div>
          <BuildInfo wake={wake} />
          <TipsReset />
        </>
      }
    >
      {content}
    </Screen>
  );
}

import { IconChevronRight, IconCopy, IconSettings } from "@tabler/icons-react";
import { useId, useState } from "react";
import { useCopyLine } from "../game/copyLine.ts";
import { HowToPlay } from "../howto/HowToPlay.tsx";
import { useCopyFeedback } from "../ui/copyFeedback.ts";
import { BackButton } from "../ui/BackButton.tsx";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button.tsx";
import { LanguageSwitcher } from "../ui/LanguageSwitcher.tsx";
import { Switch } from "../ui/Switch.tsx";
import { Screen } from "../ui/Screen.tsx";
import { canVibrate } from "./feedback.ts";
import { updateSettings, useSettings, type Theme } from "./settings.ts";
import styles from "./SettingsScreen.module.css";

const THEMES: readonly Theme[] = ["system", "light", "dark"];

/** The gear in the top bar that opens the settings. */
export function SettingsButton({ onClick }: { onClick(): void }) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" className={styles.icon} onClick={onClick} aria-label={t("settings.open")} title={t("settings.open")}>
      <IconSettings size={22} aria-hidden="true" />
    </Button>
  );
}

// The board zoom is toggled from the game's control bar (phone layout), not here.
type Flag = "sounds" | "turnTitle" | "vibration";

/** One on/off setting: the whole row is the tap target; the note says what it does. */
function Toggle({ name, disabled = false, note }: { name: Flag; disabled?: boolean; note?: string }) {
  const { t } = useTranslation();
  const settings = useSettings();
  const noteId = useId();
  return (
    <label className={styles.row} data-disabled={disabled || undefined}>
      <span className={styles.text}>
        <span className={styles.name}>{t(`settings.${name}`)}</span>
        <span id={noteId} className={styles.note}>
          {note ?? t(`settings.${name}Note`)}
        </span>
      </span>
      <Switch
        checked={settings[name] && !disabled}
        disabled={disabled}
        aria-describedby={noteId}
        onChange={(e) => updateSettings({ [name]: e.target.checked })}
      />
    </label>
  );
}

export type CopyFn = (text: string) => Promise<void>;
const clipboardCopy: CopyFn = (text) => navigator.clipboard.writeText(text);

/** The bug-report line (game id when in a game, date and time, version): shown, and copied on tap. */
function ReportLine({ roomId, copy }: { roomId?: string; copy: CopyFn }) {
  const { t } = useTranslation();
  const line = useCopyLine(roomId);
  const [state, setState] = useCopyFeedback();
  const onTap = async () => {
    const text = line();
    try {
      await copy(text);
      setState({ kind: "copied" });
    } catch {
      setState({ kind: "fallback", text });
    }
  };
  return (
    <>
      <button type="button" className={styles.row} onClick={() => void onTap()}>
        <span className={styles.text}>
          <span className={styles.name}>{t("settings.copyDetails")}</span>
          <span className={styles.note}>{line()}</span>
        </span>
        <IconCopy size={20} aria-hidden="true" className={styles.chevron} />
      </button>
      <span className={styles.status} role="status">
        {state.kind === "copied" ? t("game.copied") : ""}
      </span>
      {state.kind === "fallback" && (
        <label className={styles.fallback}>
          {t("game.copyFallback")}
          <input readOnly value={state.text} onFocus={(e) => e.currentTarget.select()} autoFocus />
        </label>
      )}
    </>
  );
}

/**
 * The device's settings: theme, sounds, the turn notification and the bug-report
 * line. Every change applies at once and is remembered on this device only.
 */
export function SettingsScreen({
  onClose,
  roomId,
  copy = clipboardCopy,
}: {
  onClose(): void;
  /** The game the settings were opened from, for the bug-report line. */
  roomId?: string;
  copy?: CopyFn;
}) {
  const { t } = useTranslation();
  const { theme } = useSettings();
  const vibrationOk = canVibrate();
  const [howToOpen, setHowToOpen] = useState(false);
  if (howToOpen) return <HowToPlay onClose={() => setHowToOpen(false)} />;
  return (
    <Screen
      start={<BackButton onClick={onClose} />}
      end={<LanguageSwitcher />}
    >
      <div className={styles.page}>
        <h1 className={styles.title}>{t("settings.title")}</h1>

        <section className={styles.group} aria-labelledby="settings-theme">
          <h2 id="settings-theme" className={styles.heading}>
            {t("settings.theme")}
          </h2>
          <div className={styles.segments} role="group" aria-labelledby="settings-theme">
            {THEMES.map((option) => (
              <button
                key={option}
                type="button"
                className={styles.segment}
                aria-pressed={theme === option}
                onClick={() => updateSettings({ theme: option })}
              >
                {t(`settings.themes.${option}`)}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.group} aria-labelledby="settings-sounds">
          <h2 id="settings-sounds" className={styles.heading}>
            {t("settings.feedback")}
          </h2>
          <Toggle name="sounds" />
          <Toggle name="turnTitle" />
          <Toggle name="vibration" disabled={!vibrationOk} note={vibrationOk ? undefined : t("settings.vibrationUnsupported")} />
        </section>

        <section className={styles.group} aria-labelledby="settings-help">
          <h2 id="settings-help" className={styles.heading}>
            {t("settings.help")}
          </h2>
          <button type="button" className={styles.row} onClick={() => setHowToOpen(true)}>
            <span className={styles.name}>{t("howTo.open")}</span>
            <IconChevronRight size={20} aria-hidden="true" className={styles.chevron} />
          </button>
        </section>

        <section className={styles.group} aria-labelledby="settings-report">
          <h2 id="settings-report" className={styles.heading}>
            {t("settings.report")}
          </h2>
          <ReportLine roomId={roomId} copy={copy} />
        </section>

        <p className={styles.footnote}>{t("settings.deviceOnly")}</p>
      </div>
    </Screen>
  );
}

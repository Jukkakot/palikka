import { IconFlipVertical, IconRotateClockwise2 } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Board } from "../game/Board.tsx";
import controls from "../game/Controls.module.css";
import { PieceTray } from "../game/PieceTray.tsx";
import { BackButton } from "../ui/BackButton.tsx";
import { Button } from "../ui/Button.tsx";
import { Screen } from "../ui/Screen.tsx";
import { browserSharer, shareOrCopy, type ShareOutcome, type Sharer } from "../ui/share.ts";
import { formatTime, loadPuzzleSave, localDate, type PuzzleResult } from "./puzzleStore.ts";
import styles from "./PuzzleScreen.module.css";
import { usePuzzle, type PuzzleOptions } from "./usePuzzle.ts";

/** The tray and the preview draw in Järvi; placed pieces take the four seat colours (`puzzleColours`). */
const TRAY_SEAT = 1;

export interface PuzzleScreenProps {
  onClose(): void;
  /** Tests: a fixed date and clock, a memory store. */
  options?: Partial<PuzzleOptions>;
  sharer?: Sharer;
}

/** A `YYYY-MM-DD` date in the language's short numeric form (e.g. 30.9.2026). */
function shortDate(date: string, language: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

/**
 * "Päivän pulma": today's shape, the pieces to fill it with, the placing controls and the clock;
 * once solved, the result (time, record, streak, share) instead of the controls and the tray.
 */
export default function PuzzleScreen({ onClose, options, sharer = browserSharer() }: PuzzleScreenProps) {
  const { t } = useTranslation();
  const [date] = useState(() => options?.date ?? localDate());
  const puzzle = usePuzzle({ ...options, date });
  const { chosen, preview, result, turn, mirror, choose, save } = puzzle;
  const count = puzzle.puzzle.pieces.length;

  // R, F and Escape while a piece is chosen (as in a game).
  useEffect(() => {
    if (chosen === undefined) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest("input, textarea, select") !== null;
      if (e.ctrlKey || e.metaKey || e.altKey || typing) return;
      const key = e.key.toLowerCase();
      if (key === "r") turn();
      else if (key === "f") mirror();
      else if (key === "escape") choose(chosen.piece);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, turn, mirror, choose]);

  const close = () => {
    save();
    onClose();
  };

  let status: string;
  if (!chosen) status = t(puzzle.placements.length > 0 ? "puzzle.lift" : "puzzle.choose");
  else if (!preview) status = t("puzzle.aim");
  else if (preview.legal) status = t("puzzle.ready");
  else status = t(`puzzle.${preview.reason ?? "OFF_SHAPE"}`);

  return (
    <Screen
      start={<BackButton onClick={close} />}
      end={
        <span className={styles.time} role="timer" aria-label={t("puzzle.time", { time: formatTime(puzzle.elapsedMs) })}>
          {formatTime(puzzle.elapsedMs)}
        </span>
      }
    >
      <div className={styles.layout}>
        <div className={styles.head}>
          <h1 className={styles.title}>{t("puzzle.title")}</h1>
          {!result && <p className={styles.intro}>{t("puzzle.intro", { count })}</p>}
        </div>
        <div className={styles.board}>
          <Board
            board={puzzle.owner}
            outside={puzzle.outside}
            preview={preview && { squares: new Set(preview.squares), legal: preview.legal, seat: TRAY_SEAT }}
            onPoint={result ? undefined : puzzle.point}
            onSquare={result ? undefined : puzzle.click}
            onMove={puzzle.moveBy}
            onConfirm={puzzle.place}
            announce={
              preview &&
              t(preview.legal ? "place.announceOk" : "place.announceBad", {
                row: preview.move.row + 1,
                col: preview.move.col + 1,
                reason: preview.legal ? "" : status,
              })
            }
          />
        </div>
        <div className={styles.side}>
          {result ? (
            <SolvedPanel result={result} date={date} sharer={sharer} store={options?.store} />
          ) : (
            <>
              <div className={controls.controls}>
                <p className={preview && !preview.legal ? `${controls.status} ${controls.warning}` : controls.status} role="status">
                  {status}
                </p>
                <div className={controls.bar}>
                  <Button variant="secondary" className={controls.withIcon} disabled={!chosen} onClick={turn} title={t("place.turnTitle")}>
                    <IconRotateClockwise2 size={20} aria-hidden="true" />
                    {t("place.turn")}
                  </Button>
                  <Button variant="secondary" className={controls.withIcon} disabled={!chosen} onClick={mirror} title={t("place.mirrorTitle")}>
                    <IconFlipVertical size={20} aria-hidden="true" />
                    {t("place.mirror")}
                  </Button>
                  <Button className={controls.place} disabled={!puzzle.ready} onClick={puzzle.place}>
                    {t("place.place")}
                  </Button>
                  <Button variant="secondary" disabled={puzzle.placements.length === 0} onClick={puzzle.clear}>
                    {t("puzzle.clear")}
                  </Button>
                </div>
              </div>
              <PieceTray
                seat={TRAY_SEAT}
                pieces={puzzle.puzzle.pieces}
                placed={puzzle.placements.map((p) => p.piece)}
                fitting={new Set(puzzle.puzzle.pieces)}
                chosen={chosen}
                onChoose={choose}
              />
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}

function SolvedPanel({ result, date, sharer, store }: { result: PuzzleResult; date: string; sharer: Sharer; store?: Storage }) {
  const { t, i18n } = useTranslation();
  const [shared, setShared] = useState<ShareOutcome>();
  const [best] = useState(() => loadPuzzleSave(store).stats.best[result.pieces]);
  const share = async () => {
    const text = t("puzzle.shareText", {
      date: shortDate(date, i18n.language),
      count: result.pieces,
      time: formatTime(result.ms),
      streak: result.streak,
    });
    const url = globalThis.location?.origin ? `${globalThis.location.origin}${globalThis.location.pathname}` : "";
    setShared(await shareOrCopy(sharer, { text, url }, url ? `${text}\n${url}` : text));
  };
  return (
    <section className={styles.solved} aria-labelledby="solved-title">
      <h2 id="solved-title" className={styles.solvedTitle}>
        {t("puzzle.solvedTitle")}
      </h2>
      <p className={styles.solvedTime}>{t("puzzle.solvedTime", { time: formatTime(result.ms) })}</p>
      {result.record ? (
        <p className={styles.record}>{t("puzzle.record")}</p>
      ) : (
        best !== undefined && <p>{t("puzzle.best", { count: result.pieces, time: formatTime(best) })}</p>
      )}
      <p>{t("puzzle.streak", { count: result.streak })}</p>
      <p className={styles.muted}>{t("puzzle.tomorrow")}</p>
      <Button onClick={() => void share()}>{t("puzzle.share")}</Button>
      <p role="status" className={styles.muted}>
        {shared === "copied" ? t("puzzle.copied") : shared === "failed" ? t("puzzle.shareFailed") : ""}
      </p>
    </section>
  );
}

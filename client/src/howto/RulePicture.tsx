import { IconCheck, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import styles from "./RulePicture.module.css";

export type RulePictureId = "start" | "corner" | "edge";

/**
 * The pictures, 5×5 from the top-left corner: "a" = a piece already on the board, "b" = the new
 * piece, "." = empty; all in the same colour (Järvi).
 */
const PICTURES: Record<RulePictureId, { rows: readonly string[]; allowed: boolean }> = {
  start: { rows: ["bb...", "b....", ".....", ".....", "....."], allowed: true },
  corner: { rows: ["aa...", "a....", ".bb..", "..b..", "....."], allowed: true },
  edge: { rows: ["aa...", "abb..", "..b..", ".....", "....."], allowed: false },
};

/** A small board picture of one placement rule, with its caption saying in words whether it is allowed. */
export function RulePicture({ id }: { id: RulePictureId }) {
  const { t } = useTranslation();
  const { rows, allowed } = PICTURES[id];
  const Mark = allowed ? IconCheck : IconX;
  return (
    <figure className={styles.figure} data-picture={id}>
      <div className={styles.board} aria-hidden="true">
        {rows.flatMap((line, r) =>
          [...line].map((ch, c) => (
            <span
              key={`${r},${c}`}
              className={[styles.cell, ch !== "." && styles.piece, ch === "b" && (allowed ? styles.newOk : styles.newBad)].filter(Boolean).join(" ")}
            />
          )),
        )}
      </div>
      <figcaption className={allowed ? styles.caption : `${styles.caption} ${styles.bad}`}>
        <Mark size={18} stroke={2.5} aria-hidden="true" />
        {t(`howTo.pictures.${id}`)}
      </figcaption>
    </figure>
  );
}

import { IconPuzzle, IconSquaresFilled, IconStar, IconTrophy } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "../ui/BackButton.tsx";
import { LanguageSwitcher } from "../ui/LanguageSwitcher.tsx";
import { Screen } from "../ui/Screen.tsx";
import styles from "./HowToPlay.module.css";
import { RulePicture } from "./RulePicture.tsx";

type SectionId = "goal" | "turn" | "place" | "score";

function Section({ id, icon, children }: { id: SectionId; icon: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className={styles.section} aria-labelledby={`howto-${id}`}>
      <h2 id={`howto-${id}`} className={styles.heading}>
        {t(`howTo.${id}.title`)}
      </h2>
      {icon}
      {children}
    </section>
  );
}

/**
 * "Näin pelaat": the rules in short sections (goal, a turn, placing a piece with pictures of the
 * start corner and the allowed and forbidden contacts, scoring).
 */
export function HowToPlay({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const icon = (node: ReactNode) => <span className={styles.icon}>{node}</span>;
  return (
    <Screen start={<BackButton onClick={onClose} />} end={<LanguageSwitcher />}>
      <article className={styles.page}>
        <h1 className={styles.title}>{t("howTo.title")}</h1>
        <Section id="goal" icon={icon(<IconTrophy size={48} stroke={1.5} aria-hidden="true" />)}>
          <p>{t("howTo.goal.body")}</p>
        </Section>
        <Section id="turn" icon={icon(<IconSquaresFilled size={48} stroke={1.5} aria-hidden="true" />)}>
          <p>{t("howTo.turn.body")}</p>
        </Section>
        <Section id="place" icon={icon(<IconPuzzle size={48} stroke={1.5} aria-hidden="true" />)}>
          <p>{t("howTo.place.body")}</p>
          <div className={styles.pictures}>
            <RulePicture id="start" />
            <RulePicture id="corner" />
            <RulePicture id="edge" />
          </div>
        </Section>
        <Section id="score" icon={icon(<IconStar size={48} stroke={1.5} aria-hidden="true" />)}>
          <p>{t("howTo.score.body")}</p>
        </Section>
      </article>
    </Screen>
  );
}

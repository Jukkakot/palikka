import { IconSquaresFilled, IconTrophy } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BackButton } from "../ui/BackButton.tsx";
import { LanguageSwitcher } from "../ui/LanguageSwitcher.tsx";
import { Screen } from "../ui/Screen.tsx";
import styles from "./HowToPlay.module.css";

type SectionId = "goal" | "turn";

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
 * "Näin pelaat": the rules in short sections (goal, a turn). Pictures of the rules come with
 * `basic-ui`.
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
      </article>
    </Screen>
  );
}

import type { ErrorInfo, ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";
import { log } from "@game-kit/client";
import { Button } from "./ui/Button.tsx";
import { Message } from "./ui/Message.tsx";
import { Screen } from "./ui/Screen.tsx";

type ErrorLogger = Pick<typeof log, "error">;

function CrashScreen() {
  const { t } = useTranslation();
  return (
    <Screen centered>
      <Message
        role="alert"
        title={t("crash.title")}
        action={<Button onClick={() => window.location.reload()}>{t("crash.reload")}</Button>}
      >
        <p>{t("crash.body")}</p>
      </Message>
    </Screen>
  );
}

/** Replaces a crashed UI with a calm, localized reload screen and logs the crash. */
export function CrashBoundary({ children, logger = log }: { children: ReactNode; logger?: ErrorLogger }) {
  const onError = (error: unknown, info: ErrorInfo) => {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(
      "client.error",
      { stack: err.stack, componentStack: info.componentStack ?? undefined, kind: "render" },
      err.message,
    );
  };
  return (
    <ErrorBoundary FallbackComponent={CrashScreen} onError={onError}>
      {children}
    </ErrorBoundary>
  );
}

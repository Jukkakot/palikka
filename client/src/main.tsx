import "./kit.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import "./ui/tokens.css";
import "./index.css";
import App from "./App.tsx";
import { CrashBoundary } from "./CrashBoundary.tsx";
import { installGlobalErrorHandlers, startLogShipping } from "@game-kit/client";
import { startTheme } from "./settings/theme.ts";

// Before the first render, so a forced theme does not flash the device's scheme.
startTheme();
installGlobalErrorHandlers();
startLogShipping();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CrashBoundary>
      <App />
    </CrashBoundary>
  </StrictMode>,
);

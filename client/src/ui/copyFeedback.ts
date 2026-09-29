import { useEffect, useState } from "react";

const CONFIRM_MS = 2_000;

/** What a copy or share left behind: nothing, a short confirmation, or the text to select by hand. */
export type CopyFeedback = { kind: "idle" } | { kind: "copied" } | { kind: "fallback"; text: string };

/** Feedback state for a tap that copies: "copied" clears itself after two seconds. */
export function useCopyFeedback() {
  const [state, setState] = useState<CopyFeedback>({ kind: "idle" });
  useEffect(() => {
    if (state.kind !== "copied") return;
    const timer = setTimeout(() => setState({ kind: "idle" }), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [state]);
  return [state, setState] as const;
}

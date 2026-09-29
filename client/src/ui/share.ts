/** How something leaves the device: the share sheet where there is one, else the clipboard. */
export interface Sharer {
  share?(data: ShareData): Promise<void>;
  copy(text: string): Promise<void>;
}

export const browserSharer = (): Sharer => ({
  share: typeof navigator !== "undefined" && navigator.share ? (data) => navigator.share(data) : undefined,
  copy: (text) => navigator.clipboard.writeText(text),
});

/** What happened: shared (or the sheet was closed on purpose), copied instead, or neither worked. */
export type ShareOutcome = "shared" | "copied" | "failed";

/** Opens the share sheet with `data`; without one (or when it fails) copies `copyText` instead. */
export async function shareOrCopy(sharer: Sharer, data: ShareData, copyText: string): Promise<ShareOutcome> {
  if (sharer.share) {
    try {
      await sharer.share(data);
      return "shared";
    } catch (err) {
      // The player closed the share sheet: nothing more to do.
      if (err instanceof Error && err.name === "AbortError") return "shared";
    }
  }
  try {
    await sharer.copy(copyText);
    return "copied";
  } catch {
    return "failed";
  }
}

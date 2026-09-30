/**
 * Board diffs for motion: which squares a board update filled or emptied. A board is an array of
 * owners per square, 0 = empty. Generic (no game names), a candidate for the shared template.
 */

/** The squares empty in `prev` and filled in `next`; none when the boards differ in size. */
export function filledSince(prev: readonly number[] | undefined, next: readonly number[]): Set<number> {
  const filled = new Set<number>();
  if (!prev || prev.length !== next.length) return filled;
  for (let i = 0; i < next.length; i++) if (prev[i] === 0 && next[i] !== 0) filled.add(i);
  return filled;
}

/** Whether any square filled in `prev` is empty in `next` (an undo, a lifted piece). */
export function emptiedSince(prev: readonly number[] | undefined, next: readonly number[]): boolean {
  if (!prev || prev.length !== next.length) return false;
  for (let i = 0; i < next.length; i++) if (prev[i] !== 0 && next[i] === 0) return true;
  return false;
}

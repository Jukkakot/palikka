/** The viewer's own target: the tile carrying their treasure, or their start corner when heading home. */
export interface TargetMark {
  tileId: number;
  home: boolean;
}

/** How `TileView` marks tile `id` when `target` names it. */
export function targetOf(id: number, target: TargetMark | undefined): "treasure" | "home" | undefined {
  if (target?.tileId !== id) return undefined;
  return target.home ? "home" : "treasure";
}

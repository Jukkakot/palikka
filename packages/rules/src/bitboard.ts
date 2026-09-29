/**
 * Boards as bitmasks: one 32-bit word per row, bit c = column c. Boards up to 32 wide.
 */
export type Bits = Uint32Array;

/** All columns of a row of a board this wide. */
export function rowMask(size: number): number {
  return size >= 32 ? 0xffffffff : (1 << size) - 1;
}

export function emptyBits(size: number): Bits {
  return new Uint32Array(size);
}

export function hasBit(bits: Bits, row: number, col: number): boolean {
  return ((bits[row]! >>> col) & 1) === 1;
}

export function setBit(bits: Bits, row: number, col: number): void {
  bits[row] = bits[row]! | (1 << col);
}

/** Squares sharing an edge with any set square (the set squares themselves may be included). */
export function edgeNeighbours(bits: Bits, size: number, out: Bits = emptyBits(size)): Bits {
  const mask = rowMask(size);
  for (let r = 0; r < size; r++) {
    const w = bits[r]!;
    const above = r > 0 ? bits[r - 1]! : 0;
    const below = r + 1 < size ? bits[r + 1]! : 0;
    out[r] = ((w << 1) | (w >>> 1) | above | below) & mask;
  }
  return out;
}

/** Squares touching any set square corner to corner. */
export function diagonalNeighbours(bits: Bits, size: number, out: Bits = emptyBits(size)): Bits {
  const mask = rowMask(size);
  for (let r = 0; r < size; r++) {
    const around = (r > 0 ? bits[r - 1]! : 0) | (r + 1 < size ? bits[r + 1]! : 0);
    out[r] = ((around << 1) | (around >>> 1)) & mask;
  }
  return out;
}

/** The set squares as "row,col" strings, row-major; for tests and debugging. */
export function bitsToSquares(bits: Bits, size: number): string[] {
  const squares: string[] = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (hasBit(bits, r, c)) squares.push(`${r},${c}`);
  return squares;
}

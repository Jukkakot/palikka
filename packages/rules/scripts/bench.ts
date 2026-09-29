/**
 * Move generation benchmark (not in CI; timing is flaky there): plays seeded random 4-colour games
 * and times a full legal-move list for every colour still in, at every position.
 *
 *   npm run bench -w @palikka/rules [-- games]
 */
import { CLASSIC, legalMoves, newPosition, type Position } from "../src/index.js";
import { randomGame } from "../src/testing.js";

const games = Number(process.argv[2] ?? 40);
const positions: Position[] = [];
for (let seed = 1; seed <= games; seed++) positions.push(...randomGame(newPosition(CLASSIC, [1, 2, 3, 4], 1), seed));

// Warm up the JIT before timing.
for (const position of positions.slice(0, 200)) for (const colour of position.colours) legalMoves(position, colour);

let calls = 0;
let moves = 0;
const started = performance.now();
for (const position of positions) {
  for (const colour of position.colours) {
    if (position.out.includes(colour)) continue;
    moves += legalMoves(position, colour).length;
    calls++;
  }
}
const ms = performance.now() - started;
console.log(`${games} games, ${positions.length} positions, ${calls} move lists, ${moves} moves`);
console.log(
  `average ${(ms / calls).toFixed(4)} ms per move list, ${Math.round((moves / ms) * 1000).toLocaleString("en")} moves/s`,
);

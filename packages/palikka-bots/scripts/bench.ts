/**
 * Greedy bot benchmark (not in CI; timing is flaky there): plays seeded 4-colour games with a
 * greedy bot on every colour and reports the time per move. Strength is measured by the tournament
 * runner and the strength check (`npm run tournament`, `npm run strength`).
 *
 *   npm run bench -w @palikka/bots [-- games]
 */
import { CLASSIC, newPosition } from "@palikka/rules";
import { greedyPlayer } from "../src/adapter.js";
import { playGame } from "../src/match.js";

const games = Number(process.argv[2] ?? 10);
const start = newPosition(CLASSIC, [1, 2, 3, 4], 1);

playGame(start, { 1: greedyPlayer, 2: greedyPlayer, 3: greedyPlayer, 4: greedyPlayer }, 0); // warm-up

let moves = 0;
let slowest = 0;
const timed = { ...greedyPlayer };
timed.choose = (state, budget, rng) => {
  const t = performance.now();
  const move = greedyPlayer.choose(state, budget, rng);
  slowest = Math.max(slowest, performance.now() - t);
  moves++;
  return move;
};
const started = performance.now();
for (let seed = 1; seed <= games; seed++) playGame(start, { 1: timed, 2: timed, 3: timed, 4: timed }, seed);
const ms = performance.now() - started;
console.log(`greedy vs greedy: ${games} games, ${moves} moves, ${(ms / moves).toFixed(2)} ms per move, slowest ${slowest.toFixed(1)} ms`);


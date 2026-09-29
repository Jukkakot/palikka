/**
 * Greedy bot benchmark (not in CI; timing is flaky there): plays seeded 4-colour games with a
 * greedy bot on every colour and reports the time per move, plus the greedy bot's win rate against
 * three random players with its seat rotating.
 *
 *   npm run bench -w @palikka/bots [-- games]
 */
import { CLASSIC, newPosition, winners } from "@palikka/rules";
import { greedyPlayer, randomPlayer } from "../src/adapter.js";
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

let wins = 0;
const rateGames = games * 4;
for (let seed = 1; seed <= rateGames; seed++) {
  const seat = ((seed - 1) % 4) + 1;
  const bots = { 1: randomPlayer, 2: randomPlayer, 3: randomPlayer, 4: randomPlayer, [seat]: greedyPlayer };
  const end = playGame(start, bots, seed).at(-1)!;
  if (winners(end).includes(seat)) wins++;
}
console.log(`greedy vs 3 random: won ${wins}/${rateGames} (${((wins / rateGames) * 100).toFixed(1)} %)`);

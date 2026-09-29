/**
 * Bot speed benchmark (not in CI; timing is flaky there): plays seeded 4-colour games with the
 * named bot on colours 1 and 3 and greedy on 2 and 4, and reports the named bot's time per move and,
 * for the search bots, the depth or iterations reached. Strength is measured by the tournament
 * runner and the strength check (`npm run tournament`, `npm run strength`).
 *
 *   npm run bench -w @palikka/bots [-- bot [games]]      e.g. greedy, brs@d2, brs@800ms, mcts@i400
 */
import { CLASSIC, newPosition, type Move, type Position } from "@palikka/rules";
import { bestReplyBot, mctsBot, type Bot } from "game-bots";
import { greedyPlayer, palikkaGame } from "../src/adapter.js";
import { evaluate } from "../src/evaluation.js";
import { playGame } from "../src/match.js";
import { parseBot } from "../src/tournament.js";

const label = process.argv[2] ?? "greedy";
const games = Number(process.argv[3] ?? 4);
const { name, bot: registered, budget } = parseBot(label);

const reached: number[] = [];
const report = (info: { depth?: number; iterations?: number }) => reached.push(info.depth ?? info.iterations ?? 0);
const bot: Bot<Position, Move> =
  name === "brs" ? bestReplyBot(palikkaGame, evaluate, { report }) : name === "mcts" ? mctsBot(palikkaGame, evaluate, { report }) : registered;

let moves = 0;
let slowest = 0;
let total = 0;
const timed: Bot<Position, Move> = {
  choose(state, _budget, rng) {
    const t = performance.now();
    const move = bot.choose(state, budget, rng);
    const ms = performance.now() - t;
    slowest = Math.max(slowest, ms);
    total += ms;
    moves++;
    return move;
  },
};
const start = newPosition(CLASSIC, [1, 2, 3, 4], 1);
playGame(start, { 1: greedyPlayer, 2: greedyPlayer, 3: greedyPlayer, 4: greedyPlayer }, 0); // warm-up
for (let seed = 1; seed <= games; seed++) playGame(start, { 1: timed, 2: greedyPlayer, 3: timed, 4: greedyPlayer }, seed);

const reach =
  reached.length === 0
    ? ""
    : `, ${name === "mcts" ? "iterations" : "depth"} avg ${(reached.reduce((a, b) => a + b, 0) / reached.length).toFixed(1)} (min ${Math.min(...reached)}, max ${Math.max(...reached)})`;
console.log(`${label}: ${games} games, ${moves} moves, ${(total / moves).toFixed(1)} ms per move, slowest ${slowest.toFixed(0)} ms${reach}`);

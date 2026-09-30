import { applyMove, CLASSIC, createRng, DUO, newPosition, scores, type BoardConfig, type Move, type Position } from "@palikka/rules";
import { systemClock, type Bot, type Budget, type GameResult, type MoveTiming, type ScheduledGame } from "game-bots";
import { brsPlayer, greedyPlayer, mctsPlayer, randomPlayer } from "./adapter.js";

/** A bot a tournament can use, with the budget it gets when its name carries none. */
interface RegisteredBot {
  readonly bot: Bot<Position, Move>;
  readonly budget: Budget;
}

/** The known bots by name. */
export const BOTS: Readonly<Record<string, RegisteredBot>> = {
  random: { bot: randomPlayer, budget: { depth: 1 } },
  greedy: { bot: greedyPlayer, budget: { depth: 1 } },
  brs: { bot: brsPlayer, budget: { depth: 2 } },
  mcts: { bot: mctsPlayer, budget: { iterations: 400 } },
};

/** A bot as named in a tournament: `greedy`, `greedy@200ms` (time limit), `brs@d2` (depth) or `mcts@i400` (iterations). */
export interface TournamentBot {
  /** The full name as given; it identifies the bot in results and reports. */
  readonly label: string;
  readonly name: string;
  readonly bot: Bot<Position, Move>;
  readonly budget: Budget;
}

/** Parses a bot name with an optional budget; throws with the known names listed when it is not valid. */
export function parseBot(label: string): TournamentBot {
  const match = /^([a-z][a-z0-9-]*)(?:@(?:(\d+)ms|d(\d+)|i(\d+)))?$/.exec(label);
  const known = Object.keys(BOTS).join(", ");
  if (!match) throw new RangeError(`Bot "${label}" is not valid: use a name, name@<n>ms, name@d<n> or name@i<n>. Known bots: ${known}`);
  const [, name, ms, depth, iterations] = match;
  const registered = BOTS[name!];
  if (!registered) throw new RangeError(`Unknown bot "${name}". Known bots: ${known}`);
  const budget: Budget =
    ms !== undefined
      ? { timeMs: Number(ms) }
      : depth !== undefined
        ? { depth: Number(depth) }
        : iterations !== undefined
          ? { iterations: Number(iterations) }
          : registered.budget;
  if ((budget.timeMs ?? 1) < 1 || (budget.depth ?? 1) < 1 || (budget.iterations ?? 1) < 1) {
    throw new RangeError(`Bot "${label}" needs a budget of at least 1`);
  }
  return { label, name: name!, bot: registered.bot, budget };
}

/** Tournament formats (`--colours`): the board and the colours each side of a pairing plays. */
export const FORMATS = {
  /** Classic board, all four colours: the first bot on 1 and 3, the second on 2 and 4. */
  4: { description: "4 colours, classic board", board: CLASSIC, sides: [[1, 3], [2, 4]] },
  /** Classic board, colours 1 and 2 (as a 2-player room seats them). */
  2: { description: "2 colours, classic board", board: CLASSIC, sides: [[1], [2]] },
  /** The Duo variant: 14×14 board, colours 1 and 2. */
  duo: { description: "Duo, 14×14 board", board: DUO, sides: [[1], [2]] },
} as const satisfies Record<number | string, { description: string; board: BoardConfig; sides: readonly [readonly number[], readonly number[]] }>;

export type Colours = keyof typeof FORMATS;

/** Whether `value` names a format: 4, 2 (numbers or digit strings) or "duo". */
export function isColours(value: unknown): value is Colours {
  return (typeof value === "number" || typeof value === "string") && Object.hasOwn(FORMATS, value) && (value === "duo" || typeof value === "number");
}

/** A `--colours` option value as a format; throws with the allowed values when it is not one. */
export function parseColours(value: string): Colours {
  const colours = /^\d+$/.test(value) ? Number(value) : value;
  if (!isColours(colours)) throw new RangeError(`--colours must be 4, 2 or duo, got ${value}`);
  return colours;
}

/** A played game plus how long each bot took per move. */
export interface PlayedGame {
  readonly result: GameResult;
  readonly timing: Record<string, MoveTiming>;
}

/**
 * Plays one scheduled game: the pairing's first bot takes the format's first side (the second when
 * swapped); colour 1 moves first; every bot gets its own budget; one rng seeded by the game's seed.
 * Seats in the result are the colours in order, each with its bot's label and final score.
 */
export function playTournamentGame(colours: Colours, bots: ReadonlyMap<string, TournamentBot>, game: ScheduledGame): PlayedGame {
  const [first, second] = game.swapped ? [game.pairing[1], game.pairing[0]] : game.pairing;
  const { board, sides } = FORMATS[colours];
  const [sideA, sideB] = sides;
  const byColour = new Map<number, TournamentBot>();
  for (const [label, side] of [[first, sideA], [second, sideB]] as const) {
    const bot = bots.get(label);
    if (!bot) throw new RangeError(`Bot ${label} is not in the tournament`);
    for (const colour of side) byColour.set(colour, bot);
  }

  const timing: Record<string, { moves: number; totalMs: number; maxMs: number }> = {};
  const rng = createRng(game.seed);
  let position = newPosition(board, [...byColour.keys()], 1);
  while (!position.ended) {
    const player = byColour.get(position.turn)!;
    const started = systemClock();
    const move = player.bot.choose(position, player.budget, rng);
    const ms = systemClock() - started;
    if (move === undefined) throw new Error(`${player.label} on colour ${position.turn} has no move`);
    const applied = applyMove(position, position.turn, move);
    if (!applied.ok) throw new Error(`${player.label} played a refused move: ${applied.code}`);
    position = applied.position;
    const t = (timing[player.label] ??= { moves: 0, totalMs: 0, maxMs: 0 });
    t.moves++;
    t.totalMs += ms;
    t.maxMs = Math.max(t.maxMs, ms);
  }

  const final = scores(position);
  return {
    result: { ...game, seats: final.map((s) => byColour.get(s.colour)!.label), scores: final.map((s) => s.score) },
    timing,
  };
}

/** Adds one game's timing into running totals. */
export function addTiming(totals: Map<string, MoveTiming>, timing: Readonly<Record<string, MoveTiming>>): void {
  for (const [bot, t] of Object.entries(timing)) {
    const sum = totals.get(bot) ?? { moves: 0, totalMs: 0, maxMs: 0 };
    totals.set(bot, { moves: sum.moves + t.moves, totalMs: sum.totalMs + t.totalMs, maxMs: Math.max(sum.maxMs, t.maxMs) });
  }
}

/** Whether any bot plays with a time limit (the results then depend on the machine). */
export function isTimeLimited(bots: Iterable<TournamentBot>): boolean {
  for (const bot of bots) if (bot.budget.timeMs !== undefined) return true;
  return false;
}

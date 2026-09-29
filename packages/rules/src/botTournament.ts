import type { BotStrategy } from "./bot.js";
import { botSeed } from "./bot.js";
import { applyMove, applyShift, botViewOf, startGame, type GameCommandResult, type GameState } from "./game.js";
import { createRng } from "./rng.js";

/*
 * Whole games among bots, for tests and for comparing strategies. Not part of the package's
 * public entry point.
 */

// The rules package has no DOM or Node types; both runtimes have a high-resolution clock.
const clock: { now(): number } = (globalThis as { performance?: { now(): number } }).performance ?? Date;

export interface GameResult {
  winner: number;
  turns: number;
}

/** Wall-clock time spent choosing turns, per seat. */
export interface TurnTimes {
  total: number;
  max: number;
  count: number;
}

/**
 * Plays a whole game among bots (`strategies` by seat) through the game engine, so every turn is
 * checked against the rules.
 * Undefined when nobody wins within `turnCap` turns. `times` collects the time each seat's
 * strategy took per turn.
 */
export function simulateGame(
  seed: number,
  strategies: ReadonlyMap<number, BotStrategy>,
  turnCap = 1500,
  times?: Map<number, TurnTimes>,
): GameResult | undefined {
  const seats = [...strategies.keys()];
  let state = startGame(
    seed,
    seats.map((seat) => ({ seat, name: `bot${seat}`, bot: true })),
  );
  // One rng per seat for the whole game (not `botRngFor`), so tournament results stay comparable.
  const rngs = new Map(seats.map((s) => [s, createRng(botSeed(seed, s))]));
  const legal = (result: GameCommandResult): GameState => {
    if (!result.ok) throw new Error(`illegal bot turn: ${result.code}`);
    return result.state;
  };
  for (let turns = 1; turns <= turnCap; turns++) {
    const seat = state.turnSeat;
    const started = clock.now();
    const turn = strategies.get(seat)!(botViewOf(state, seat), rngs.get(seat)!);
    if (times) {
      const took = clock.now() - started;
      const t = times.get(seat) ?? { total: 0, max: 0, count: 0 };
      times.set(seat, { total: t.total + took, max: Math.max(t.max, took), count: t.count + 1 });
    }
    state = legal(applyShift(state, seat, turn.insertion, turn.rotation));
    state = legal(applyMove(state, seat, turn.to));
    if (state.step === "finished") return { winner: state.winnerSeat, turns };
  }
  return undefined;
}

export interface Standing {
  games: number;
  wins: number;
  /** Mean and worst time per turn in milliseconds. */
  meanMs: number;
  maxMs: number;
}

export interface TournamentResult {
  standings: Map<string, Standing>;
  /** Games nobody won within the turn cap. */
  unfinished: number;
  /** Mean number of turns of the finished games. */
  meanTurns: number;
}

/**
 * Plays `games` games on `seatCount` seats. Every game rotates who sits where (`lineup` gives the
 * strategy names in seat order and is rotated by the game number), so no strategy keeps the best
 * seat. Wins and turn times are counted per strategy name.
 */
export function runTournament(
  strategies: Readonly<Record<string, BotStrategy>>,
  lineup: readonly string[],
  games: number,
  firstSeed = 1,
): TournamentResult {
  const seatCount = lineup.length;
  const seats = seatCount === 2 ? [1, 3] : seatCount === 3 ? [1, 2, 4] : [1, 2, 3, 4];
  const standings = new Map<string, Standing>(Object.keys(strategies).map((name) => [name, { games: 0, wins: 0, meanMs: 0, maxMs: 0 }]));
  const time = new Map<string, TurnTimes>();
  let unfinished = 0;
  let turnSum = 0;
  for (let g = 0; g < games; g++) {
    const names = seats.map((_, i) => lineup[(i + g) % seatCount]!);
    const bySeat = new Map(seats.map((s, i) => [s, strategies[names[i]!]!]));
    const times = new Map<number, TurnTimes>();
    const result = simulateGame(firstSeed + g, bySeat, 1500, times);
    new Set(names).forEach((name) => (standings.get(name)!.games += 1));
    seats.forEach((s, i) => {
      const t = times.get(s);
      if (!t) return;
      const acc = time.get(names[i]!) ?? { total: 0, max: 0, count: 0 };
      time.set(names[i]!, { total: acc.total + t.total, max: Math.max(acc.max, t.max), count: acc.count + t.count });
    });
    if (!result) {
      unfinished++;
      continue;
    }
    turnSum += result.turns;
    standings.get(names[seats.indexOf(result.winner)]!)!.wins += 1;
  }
  for (const [name, s] of standings) {
    const t = time.get(name);
    if (t) standings.set(name, { ...s, meanMs: t.total / t.count, maxMs: t.max });
  }
  return { standings, unfinished, meanTurns: turnSum / Math.max(1, games - unfinished) };
}

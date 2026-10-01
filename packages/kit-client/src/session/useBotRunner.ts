import { MAX_GAME_SEED, type BotSpeed, type CommandResult } from "@game-kit/protocol";
import { useEffect, useState } from "react";
import { log } from "../logging/logger.ts";
import { BOT_DELAY_MS } from "./localRoom.ts";
import type { LobbyView } from "./lobbyView.ts";
import type { GameRoomLike } from "./roomLike.ts";

/** Asks the game's bot for the move of the bot-played seat on turn in `view`. */
export type AskViewBot<V, M> = (view: V, speed: BotSpeed, seed: number) => Promise<M | undefined>;

/** The turn this viewer's browser must play for a bot, as a key; undefined when there is none. */
export function botTurnKey(view: LobbyView | undefined): string | undefined {
  if (!view || view.phase !== "playing") return undefined;
  if (view.mySeat === undefined || view.mySeat !== view.botRunnerSeat || !view.turnBotPlayed) return undefined;
  return `${view.turn}:${view.turnSeat}`;
}

const randomSeed = () => Math.floor(Math.random() * (MAX_GAME_SEED + 1));

/**
 * Online games: while this viewer is the bot runner, every turn of a bot-played seat gets its move
 * from the game's bot and is sent as `botMove` once the usual pause since the turn began is over.
 * The server validates it like any move; a turn that moves on first drops the answer. It never
 * blocks the player's own commands and shows them nothing: a refusal is only logged.
 */
export function useBotRunner<V extends LobbyView, M>(room: GameRoomLike | undefined, view: V | undefined, askBot: AskViewBot<V, M>): void {
  const key = botTurnKey(view);
  // The view as the turn began: later views of the same turn (a connection, a spectator) change nothing.
  const [turn, setTurn] = useState<{ key?: string; view?: V }>({});
  if (turn.key !== key) setTurn({ key, view: key ? view : undefined });
  const turnView = turn.key === key ? turn.view : undefined;
  const seat = turnView?.turnSeat ?? 0;
  const speed = (turnView?.botSpeed ?? 1) as BotSpeed;

  useEffect(() => {
    if (!room || !key || !turnView) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const due = Date.now() + BOT_DELAY_MS / speed;

    const send = async (move: M) => {
      try {
        const result = (await room.request("botMove", { seat, move })) as CommandResult;
        if (!result.ok) log.warn("client.cmd.rejected", { cmd: "botMove", code: result.code, seat });
      } catch (err) {
        log.warn("client.warn", { kind: "command", cmd: "botMove" }, err instanceof Error ? err.message : String(err));
      }
    };

    askBot(turnView, speed, randomSeed()).then(
      (move) => {
        if (cancelled) return;
        if (move === undefined) {
          log.warn("client.warn", { kind: "bot.noMove", seat });
          return;
        }
        timer = setTimeout(() => void send(move), Math.max(0, due - Date.now()));
      },
      (err: unknown) => log.error("client.error", { kind: "bot.runner" }, err instanceof Error ? err.message : String(err)),
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [room, key, turnView, seat, speed, askBot]);
}

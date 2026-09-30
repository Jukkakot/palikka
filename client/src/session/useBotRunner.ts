import type { BotPlacePayload, CommandResult } from "@palikka/protocol";
import { MAX_SEED, type Position } from "@palikka/rules";
import { useEffect, useState } from "react";
import { BOT_DELAY_MS, botBudget, type AskBot } from "../bots/botMoves.ts";
import { askBotWorker } from "../bots/botWorkerClient.ts";
import { log } from "../logging/logger.ts";
import type { GameRoomLike } from "./useGameSession.ts";
import type { GameView } from "./viewModel.ts";

/** The turn this viewer's browser must play for a bot, as a key; undefined when there is none. */
export function botTurnKey(view: GameView | undefined): string | undefined {
  if (!view?.position || view.phase !== "playing") return undefined;
  if (view.mySeat === undefined || view.mySeat !== view.botRunnerSeat || !view.turnBotPlayed) return undefined;
  return `${view.turn}:${view.turnSeat}`;
}

const randomSeed = () => Math.floor(Math.random() * (MAX_SEED + 1));

/**
 * Online games: while this viewer is the bot runner, every turn of a bot-played seat gets its move
 * from the bot worker and is sent as `botPlace` once the usual pause since the turn began is over.
 * The server validates it like any move; a turn that moves on first drops the answer. It never
 * blocks the player's own commands and shows them nothing: a refusal is only logged.
 */
export function useBotRunner(room: GameRoomLike | undefined, view: GameView | undefined, askBot: AskBot = askBotWorker): void {
  const key = botTurnKey(view);
  // The position as the turn began: later views of the same turn (a connection, a spectator) change nothing.
  const [turn, setTurn] = useState<{ key?: string; position?: Position }>({});
  if (turn.key !== key) setTurn({ key, position: key ? view?.position : undefined });
  const position = turn.key === key ? turn.position : undefined;
  const seat = view?.turnSeat ?? 0;
  const colour = view?.turnColour || seat;
  // The shared colour is played for the seat whose turn it is to play it.
  const viewpoint = view?.turnShared ? view.seats.find((s) => s.seat === seat)?.colours[0] : undefined;
  const speed = view?.botSpeed ?? 1;

  useEffect(() => {
    if (!room || !key || !position) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const due = Date.now() + BOT_DELAY_MS / speed;

    const send = async (move: Omit<BotPlacePayload, "seat">) => {
      try {
        const result = (await room.request("botPlace", { seat, ...move } satisfies BotPlacePayload)) as CommandResult;
        if (!result.ok) log.warn("client.cmd.rejected", { cmd: "botPlace", code: result.code, seat });
      } catch (err) {
        log.warn("client.warn", { kind: "command", cmd: "botPlace" }, err instanceof Error ? err.message : String(err));
      }
    };

    askBot({ position, colour, budget: botBudget(speed), seed: randomSeed(), ...(viewpoint !== undefined && { viewpoint }) }).then(
      (move) => {
        if (cancelled) return;
        if (!move) {
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
  }, [room, key, position, seat, colour, viewpoint, speed, askBot]);
}

import {
  createConnector as createKitConnector,
  noticeKey as kitNoticeKey,
  useKitSession,
  type Connector as KitConnector,
  type KitSession,
} from "@game-kit/client";
import { GAME_ERROR_CODES, type BotSpeed, type CommandResult, type GameErrorCode, type PlacePayload, type VariantId } from "@palikka/protocol";
import type { PalikkaOptions } from "@palikka/rules";
import { useCallback } from "react";
import { palikkaClient } from "./palikkaClient.ts";
import type { GameView } from "./viewModel.ts";

export {
  joinFailure,
  NOTICE_MS,
  quickPlayPool,
  RESUME_TOUCH_MS,
  sdkClient,
  SLOW_CONNECT_MS,
  type GameRoomLike,
  type JoinRequest,
  type SessionStatus,
  type StartNotice,
} from "@game-kit/client";

/** Palikka's connector: device games with Palikka's options. */
export type Connector = KitConnector<PalikkaOptions>;

/** The connector with Palikka's client definition. */
export const createConnector = (): Connector => createKitConnector(palikkaClient);

export type NoticeKey = `errors.${GameErrorCode}` | "errors.generic" | "spectate.lateInvite";

/** i18n key for a rejection code: `errors.<CODE>` for known game codes, else `errors.generic`. */
export function noticeKey(code: string): NoticeKey {
  return kitNoticeKey(code, GAME_ERROR_CODES) as NoticeKey;
}

export interface GameSession extends Omit<KitSession<GameView, PalikkaOptions>, "playBots" | "watchBots" | "notice" | "command"> {
  /** A quick game of `variant` (Perus by default) against 1–3 bots (the other variants set the count), straight into the game. */
  playBots(nickname: string, bots: number, variant?: VariantId): void;
  /** Watches a new game of `variant` with 2–4 bots on the device (leaving the current game, if any). */
  watchBots(nickname: string, bots: number, speed?: BotSpeed, variant?: VariantId): void;
  /** The host chooses the variant in the waiting room. Resolves undefined without sending while another command is pending. */
  setVariant(variant: VariantId): Promise<CommandResult | undefined>;
  /** Places a piece (the whole turn). Resolves undefined without sending while another command is pending. */
  place(move: PlacePayload): Promise<CommandResult | undefined>;
  /** i18n key of the message for the last rejected command, shown for NOTICE_MS. */
  notice?: NoticeKey;
}

/**
 * Palikka's session: the kit's session with Palikka's definition, plus placing a piece (`move`) and
 * choosing the variant (`setOptions`). A tab with a stored reconnection token rejoins its game on
 * load; otherwise it waits for createGame(), joinById() or another way in.
 */
export function useGameSession(connector?: Connector): GameSession {
  const { command, playBots: kitPlayBots, watchBots: kitWatchBots, notice, ...session } = useKitSession({
    definition: palikkaClient,
    errorCodes: GAME_ERROR_CODES,
    connector,
  });
  const playBots = useCallback(
    (nickname: string, bots: number, variant?: VariantId) => kitPlayBots(nickname, bots, variant && { variant }),
    [kitPlayBots],
  );
  const watchBots = useCallback(
    (nickname: string, bots: number, speed?: BotSpeed, variant?: VariantId) => kitWatchBots(nickname, bots, speed, variant && { variant }),
    [kitWatchBots],
  );
  const setVariant = useCallback((variant: VariantId) => command("setOptions", { options: { variant } }), [command]);
  const place = useCallback(({ piece, orientation, row, col }: PlacePayload) => command("move", { move: { piece, orientation, row, col } }), [command]);
  return { ...session, playBots, watchBots, setVariant, place, notice: notice as NoticeKey | undefined };
}

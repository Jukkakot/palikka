import { Room, type Client, type CloseCode, type Deferred, type RoomException, type RoomOptions } from "colyseus";
import type { z } from "zod";
import { log, type LogFields } from "../logging/logger.js";
import { defineCommand, type Actor } from "./command.js";
import { uniqueRoomId } from "./roomId.js";

/**
 * Base class for all rooms: readable room id, lifecycle log lines and logging
 * of uncaught exceptions. Subclasses overriding a hook must call `super`.
 */
export abstract class LoggedRoom<T extends RoomOptions = RoomOptions> extends Room<T> {
  /** Context fields for log lines about this room and, optionally, a client or bot. */
  protected logCtx(actor?: Actor, extra?: LogFields): LogFields {
    return { room: this.roomId, ...(actor && { player: actor.sessionId }), ...(actor?.bot && { bot: true }), ...extra };
  }

  /**
   * Defines a command handler for `messages` (sent by clients with `room.request()`):
   * payload validation, one audit line, uniform `{ ok }` reply. Throw
   * `CommandRejection` from the handler, before changing state, to reject.
   */
  protected command<S extends z.ZodType>(
    name: string,
    schema: S,
    handler: (actor: Actor, payload: z.infer<S>) => void | Promise<void>,
  ) {
    return defineCommand(
      { logCtx: (actor, extra) => this.logCtx(actor, extra), stateFacts: () => this.commandStateFacts() },
      name,
      schema,
      handler,
    );
  }

  /** Room state added to rejected and failed command lines (phase, turn …). */
  protected commandStateFacts(): Record<string, unknown> {
    return {};
  }

  async onCreate(_options?: unknown): Promise<void> {
    // Colyseus allows replacing roomId only during onCreate.
    this.roomId = await uniqueRoomId();
    log.info("room.created", this.logCtx(undefined, { name: this.roomName }));
  }

  /** `extra` adds room-specific facts to the `player.joined` line. */
  onJoin(client: Client, _options?: unknown, _auth?: unknown, extra?: LogFields): void | Promise<void> {
    log.info("player.joined", this.logCtx(client, extra));
  }

  onLeave(client: Client, code?: CloseCode): void | Promise<void> {
    log.info("player.left", this.logCtx(client, { code }));
  }

  /**
   * Unintended disconnect: holds the seat for `seconds` so the client can reconnect.
   * Rejecting the returned hold ends it early (the player is then gone for good).
   */
  protected holdSeat(client: Client, code: CloseCode | undefined, seconds: number): Deferred<Client> {
    log.info("player.dropped", this.logCtx(client, { code, holdSeconds: seconds }));
    const hold = this.allowReconnection(client, seconds);
    // Outcome is routed to onReconnect() or onLeave(); the catch covers disposal.
    hold.catch(() => {});
    return hold;
  }

  onReconnect(client: Client): void | Promise<void> {
    log.info("player.reconnected", this.logCtx(client));
  }

  onDispose(): void | Promise<void> {
    log.info("room.disposed", this.logCtx());
  }

  onUncaughtException(error: RoomException, methodName: string): void {
    log.error("room.error", this.logCtx(undefined, { method: methodName, err: error.cause ?? error }));
  }
}

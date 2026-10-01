import { Client } from "@colyseus/sdk";
import { CLOSE_CODES, type BotSpeed, type CommandResult, type JoinErrorCode, type JoinOptions, type WatchRequest } from "@game-kit/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { kitConfig } from "../config.ts";
import type { GameClientDefinition } from "../definition.ts";
import { log, setLogContext } from "../logging/logger.ts";
import { isLocalRoomId, isLocalToken, roomIdOfToken } from "./localGameStore.ts";
import { LocalRoom } from "./localRoom.ts";
import { toLobbyView, type LobbyView, type SyncedLobbyState } from "./lobbyView.ts";
import { loadNickname, randomNickname, saveNickname } from "./nickname.ts";
import { clearResume, loadResume, saveResume, type ResumeRecord } from "./resumeRecord.ts";
import type { GameRoomLike } from "./roomLike.ts";
import { clearToken, loadToken, saveToken } from "./sessionToken.ts";
import { useBotRunner } from "./useBotRunner.ts";

/** What the player chooses when joining; the connector adds the page's pool. */
export type JoinRequest = Pick<JoinOptions, "nickname">;

export interface Connector<O = unknown> {
  /** "Luo peli kavereille": always a new public game, with the caller as its host. */
  create(options: JoinRequest): Promise<GameRoomLike>;
  /** A quick game against `bots` bots: never listed, started as soon as the caller is seated. */
  createBotGame(options: JoinRequest & { bots: number; options?: O }): Promise<GameRoomLike>;
  /** One particular game, from the list or an invite link. */
  joinById(roomId: string, options: JoinRequest): Promise<GameRoomLike>;
  /** Watch a running game as a spectator (through the server's watch route). */
  watch(roomId: string, options: JoinRequest): Promise<GameRoomLike>;
  /** A new game of bots only on the device, watched by the caller. */
  createBotWatch(options: { bots: number; speed: BotSpeed; options?: O }): Promise<GameRoomLike>;
  reconnect(token: string): Promise<GameRoomLike>;
}

/** Optional pool from `?pool=…`: players only meet others in the same pool. */
export function quickPlayPool(search = globalThis.location?.search ?? ""): string | undefined {
  const pool = new URLSearchParams(search).get("pool")?.trim();
  return pool ? pool.slice(0, 64) : undefined;
}

let sharedClient: Client | undefined;

/**
 * The page's one SDK client, shared by the game session and the open-games list. Created on first
 * use: the game's `serverUrl` may throw in a production build without one.
 */
export function sdkClient(): Client {
  return (sharedClient ??= new Client(kitConfig().serverUrl()));
}

/**
 * Games against bots run on the device (ids and tokens with the local prefix); everything else
 * goes to the server's `game` rooms. The SDK client is only created for the server's games.
 */
export function createConnector<G, M, O, V extends LobbyView>(definition: GameClientDefinition<G, M, O, V>): Connector<O> {
  const pool = quickPlayPool();
  const withPool = (options: JoinRequest): JoinOptions<O> => ({ ...options, ...(pool && { pool }) });
  /** The saved game on the device with this id; rejects like a gone server room when it is not there. */
  const restoreLocal = async (roomId: string): Promise<GameRoomLike> => {
    const room = LocalRoom.restore(definition, roomId);
    if (!room) throw Object.assign(new Error("local game gone"), { code: 524 });
    return room;
  };
  return {
    create: (options) => sdkClient().create("game", withPool(options)) as unknown as Promise<GameRoomLike>,
    createBotGame: async ({ bots, nickname, options }) => LocalRoom.create(definition, nickname, bots, options),
    joinById: (roomId, options) =>
      isLocalRoomId(roomId) ? restoreLocal(roomId) : (sdkClient().joinById(roomId, withPool(options)) as unknown as Promise<GameRoomLike>),
    watch: async (roomId, { nickname }) => {
      // JSON as text/plain: no CORS preflight.
      const res = await fetch(`${kitConfig().serverUrl()}/watch`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ roomId, nickname } satisfies WatchRequest),
      });
      if (!res.ok) throw new Error(res.status === 400 ? "INVALID_OPTIONS" : ("NOT_WATCHABLE" satisfies JoinErrorCode));
      return sdkClient().consumeSeatReservation(await res.json()) as unknown as Promise<GameRoomLike>;
    },
    createBotWatch: async ({ bots, speed, options }) => LocalRoom.createWatch(definition, bots, speed, options),
    reconnect: (token) =>
      isLocalToken(token) ? restoreLocal(roomIdOfToken(token)) : (sdkClient().reconnect(token) as unknown as Promise<GameRoomLike>),
  };
}

export type SessionStatus = "idle" | "connecting" | "playing" | "error";

/**
 * What the start screen says about the last game or join attempt: removed by a kick, the host
 * closed the waiting room, the chosen game is no longer open, or the server is full.
 */
export type StartNotice = "kicked" | "hostLeft" | "notOpen" | "serverFull" | "resumeGone";

/** Thrown by a resume attempt whose seat is no longer held. */
const RESUME_GONE = "RESUME_GONE";

/** SDK matchmaking codes for a game that is gone, locked (started or full), or a seat that expired. */
const NOT_OPEN_CODES: readonly unknown[] = [522, 524];

/** Why a join failed, as a calm start-screen notice; undefined for the generic error with retry. */
export function joinFailure(err: unknown): StartNotice | undefined {
  const { message, code } = (err ?? {}) as { message?: unknown; code?: unknown };
  if (message === RESUME_GONE) return "resumeGone";
  if (message === ("SERVER_FULL" satisfies JoinErrorCode)) return "serverFull";
  if (message === ("NOT_WATCHABLE" satisfies JoinErrorCode)) return "notOpen";
  if (NOT_OPEN_CODES.includes(code)) return "notOpen";
  return undefined;
}

/** Leaves `room` on the server without anything coming back from it. */
function quit(room: GameRoomLike): void {
  room.removeAllListeners();
  room.leave().catch((err: unknown) => {
    log.warn("client.warn", { kind: "leave" }, err instanceof Error ? err.message : String(err));
  });
}

/** After this long in "connecting" the UI explains that the server may be waking up. */
export const SLOW_CONNECT_MS = 5_000;

/** How often a running game refreshes when the player was last seen, for resuming after closing the app. */
export const RESUME_TOUCH_MS = 15_000;

/** How long "Pelaa uudelleen" waits for the new game's id to arrive. */
const REMATCH_WAIT_MS = 10_000;

/** How long a rejection message stays on screen. */
export const NOTICE_MS = 4_000;

/** i18n key for a rejection code: `errors.<CODE>` for the game's known codes, else `errors.generic`. */
export function noticeKey(code: string, known: readonly string[]): string {
  return known.includes(code) ? `errors.${code}` : "errors.generic";
}

export interface KitSession<V extends LobbyView, O> {
  status: SessionStatus;
  view?: V;
  /** True when connecting has taken longer than SLOW_CONNECT_MS. */
  slow: boolean;
  /** A new online game for friends under `nickname` (valid and trimmed), straight into its waiting room. */
  createGame(nickname: string): void;
  /** Joins one particular game (from the list or an invite link). */
  joinById(roomId: string, nickname: string): void;
  /** A quick game against `bots` bots on the device with `options`, straight into the game. */
  playBots(nickname: string, bots: number, options?: O): void;
  /** Games against bots on the device: takes back the player's last move and the bots' moves after it. */
  undo(): Promise<CommandResult | undefined>;
  /** Joins an invited game; if it has already started, watches it instead. */
  joinInvite(roomId: string, nickname: string): void;
  /** Watches a running game. */
  watch(roomId: string, nickname: string): void;
  /** Watches a new game of `bots` bots on the device (leaving the current game, if any). */
  watchBots(nickname: string, bots: number, speed?: BotSpeed, options?: O): void;
  /** A spectator sets the bots' speed. Resolves undefined without sending while another command is pending. */
  setSpeed(speed: BotSpeed): Promise<CommandResult | undefined>;
  /** Hands the viewer's seat to the bot (`on`) or takes it back. Resolves undefined without sending while another command is pending. */
  setAutoplay(on: boolean): Promise<CommandResult | undefined>;
  /** In a finished game: asks for the rematch game (if nobody has yet) and moves there. */
  rematch(): void;
  /** True from tapping "Pelaa uudelleen" until the move to the new game begins. */
  rematching: boolean;
  /** The nickname to use for the next game: the last one used, else a random one. */
  nickname(): string;
  /** A game left open when the app was closed, still within its seat hold: offered as "Jatka peliä". */
  resumable?: ResumeRecord;
  /** Rejoins the resumable game; if its seat is gone, the start screen gets the resumeGone notice. */
  resume(): void;
  /** Repeats the last join attempt after the generic join error. */
  retry(): void;
  /** The host starts the game from the waiting room. Resolves undefined without sending while another command is pending. */
  start(): Promise<CommandResult | undefined>;
  /** The host seats a bot in a free seat of the waiting room. Resolves undefined without sending while another command is pending. */
  addBot(seat: number): Promise<CommandResult | undefined>;
  /** The host removes the bot in `seat` from the waiting room. Resolves undefined without sending while another command is pending. */
  removeBot(seat: number): Promise<CommandResult | undefined>;
  /** Kicks the current player once their time is up. Resolves undefined without sending while another command is pending. */
  kick(seat: number): Promise<CommandResult | undefined>;
  /**
   * Sends any command, the game's own too (`move`, `setOptions` …). Resolves undefined without
   * sending while another command is pending.
   */
  command(name: string, payload: unknown): Promise<CommandResult | undefined>;
  /** Leaves the game or waiting room; the start screen shows at once. */
  leave(): void;
  /** What the start screen says about the last game or join attempt; cleared by the next attempt. */
  startNotice?: StartNotice;
  /** True while a command waits for the server. */
  pending: boolean;
  /** i18n key of the message for the last rejected command (`errors.<CODE>`), shown for NOTICE_MS. */
  notice?: string;
}

export interface KitSessionOptions<G, M, O, V extends LobbyView> {
  definition: GameClientDefinition<G, M, O, V>;
  /** The game's rejection codes that have a message (`errors.<CODE>`); others get `errors.generic`. */
  errorCodes: readonly string[];
  connector?: Connector<O>;
}

/**
 * Joining games and per-tab rejoin. A tab with a stored reconnection token rejoins its game on
 * load; otherwise it waits for createGame(), joinById() or another way in.
 */
export function useKitSession<G, M, O, V extends LobbyView>({ definition, errorCodes, connector }: KitSessionOptions<G, M, O, V>): KitSession<V, O> {
  const connectorRef = useRef<Connector<O> | undefined>(connector);
  const started = useRef(false);
  const [status, setStatus] = useState<SessionStatus>(() => (loadToken() ? "connecting" : "idle"));
  const [view, setView] = useState<V>();
  const [slow, setSlow] = useState(false);
  const roomRef = useRef<GameRoomLike | undefined>(undefined);
  /** The same room as state, for what renders from it (the bot runner). */
  const [activeRoom, setActiveRoom] = useState<GameRoomLike>();
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [startNotice, setStartNotice] = useState<StartNotice>();
  const lastAttempt = useRef<{ run: () => Promise<GameRoomLike>; nickname: string }>(undefined);
  /** A message to show once the join under way has succeeded. */
  const joinNotice = useRef<string>(undefined);
  const [rematching, setRematching] = useState(false);
  // A tab with its own token rejoins by itself; only a fresh tab or app offers the remembered game.
  const [resumable, setResumable] = useState<ResumeRecord | undefined>(() => (loadToken() ? undefined : loadResume()));
  /** The player holds a seat in an unfinished game: the game is worth resuming after closing. */
  const resumableRef = useRef(false);
  const definitionRef = useRef(definition);

  const getConnector = () => (connectorRef.current ??= createConnector(definitionRef.current));

  /** Forgets the game locally and shows the start screen. */
  const detach = useCallback(() => {
    roomRef.current = undefined;
    setActiveRoom(undefined);
    resumableRef.current = false;
    clearToken();
    clearResume();
    setLogContext({});
    setView(undefined);
    setRematching(false);
    setStatus("idle");
  }, []);

  const attach = useCallback(
    (room: GameRoomLike) => {
      roomRef.current = room;
      setActiveRoom(room);
      saveToken(room.reconnectionToken);
      setLogContext({ room: room.roomId, player: room.sessionId });
      const update = (state: SyncedLobbyState) => {
        const next = definitionRef.current.toView(state, toLobbyView(state, room.roomId, room.sessionId));
        if (!next) return;
        setView(next);
        const worth = next.mySeat !== undefined && next.phase !== "finished";
        if (worth && !resumableRef.current) saveResume(room.reconnectionToken, room.roomId);
        if (!worth && resumableRef.current) clearResume();
        resumableRef.current = worth;
      };
      room.onStateChange(update);
      room.onDrop(() => log.info("client.conn.lost", { room: room.roomId }));
      room.onReconnect(() => {
        saveToken(room.reconnectionToken);
        if (resumableRef.current) saveResume(room.reconnectionToken, room.roomId);
        log.info("client.conn.restored", { room: room.roomId });
      });
      room.onLeave((code) => {
        // After a leave this tab asked for, nothing may bring the game back or set a reason.
        if (roomRef.current !== room) return;
        detach();
        if (code === CLOSE_CODES.KICKED) setStartNotice("kicked");
        if (code === CLOSE_CODES.HOST_LEFT) setStartNotice("hostLeft");
        log.info("client.conn.lost", { room: room.roomId, code, final: true });
      });
      setResumable(undefined);
      update(room.state);
      setStatus("playing");
    },
    [detach],
  );

  // Rejoin this tab's game after a reload (guarded against StrictMode's double effect).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = loadToken();
    if (!token) return;
    getConnector()
      .reconnect(token)
      .then(attach)
      .catch(() => {
        clearToken();
        setStatus("idle");
      });
  }, [attach]);

  // Keep the remembered game's last-seen time fresh, also as the page is hidden or closed.
  useEffect(() => {
    if (status !== "playing") return;
    const touch = () => {
      const room = roomRef.current;
      if (room && resumableRef.current) saveResume(room.reconnectionToken, room.roomId);
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") touch();
    };
    const timer = setInterval(touch, RESUME_TOUCH_MS);
    globalThis.addEventListener?.("pagehide", touch);
    globalThis.document?.addEventListener("visibilitychange", onHidden);
    return () => {
      clearInterval(timer);
      globalThis.removeEventListener?.("pagehide", touch);
      globalThis.document?.removeEventListener("visibilitychange", onHidden);
    };
  }, [status]);

  // "Server may be waking up" hint while connecting.
  useEffect(() => {
    if (status !== "connecting") return;
    const timer = setTimeout(() => setSlow(true), SLOW_CONNECT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  /**
   * Runs one join attempt, leaving the current game first (rematch, another bot game): success
   * remembers the nickname; a failure becomes a start notice or the error state.
   */
  const connect = useCallback(
    (run: () => Promise<GameRoomLike>, nickname: string) => {
      const current = roomRef.current;
      if (current) {
        detach();
        quit(current);
      }
      lastAttempt.current = { run, nickname };
      // Any join replaces the remembered game; a resume that works remembers it again.
      clearResume();
      setResumable(undefined);
      setSlow(false);
      setStartNotice(undefined);
      setStatus("connecting");
      run()
        .then((room) => {
          saveNickname(nickname);
          attach(room);
          if (joinNotice.current) setNotice(joinNotice.current);
          joinNotice.current = undefined;
        })
        .catch((err: unknown) => {
          const failure = joinFailure(err);
          const message = err instanceof Error ? err.message : String(err);
          log.warn("client.warn", { kind: "join", reason: failure ?? "error" }, message);
          joinNotice.current = undefined;
          setStartNotice(failure);
          setStatus(failure ? "idle" : "error");
        });
    },
    [attach, detach],
  );

  const createGame = useCallback((nickname: string) => connect(() => getConnector().create({ nickname }), nickname), [connect]);
  const playBots = useCallback(
    (nickname: string, bots: number, options?: O) => connect(() => getConnector().createBotGame({ nickname, bots, options }), nickname),
    [connect],
  );
  const joinById = useCallback(
    (roomId: string, nickname: string) => connect(() => getConnector().joinById(roomId, { nickname }), nickname),
    [connect],
  );
  const watch = useCallback(
    (roomId: string, nickname: string) => connect(() => getConnector().watch(roomId, { nickname }), nickname),
    [connect],
  );
  const watchBots = useCallback(
    (nickname: string, bots: number, speed: BotSpeed = 1, options?: O) =>
      connect(() => getConnector().createBotWatch({ bots, speed, options }), nickname),
    [connect],
  );
  const joinInvite = useCallback(
    (roomId: string, nickname: string) =>
      connect(async () => {
        try {
          return await getConnector().joinById(roomId, { nickname });
        } catch (err) {
          // Started already: watch it instead, and say so once.
          if (joinFailure(err) !== "notOpen") throw err;
          const room = await getConnector().watch(roomId, { nickname });
          joinNotice.current = "spectate.lateInvite";
          return room;
        }
      }, nickname),
    [connect],
  );
  const nickname = useCallback(() => lastAttempt.current?.nickname || loadNickname() || randomNickname("fi"), []);
  const resume = useCallback(() => {
    if (!resumable) return;
    const { token } = resumable;
    connect(async () => {
      try {
        return await getConnector().reconnect(token);
      } catch {
        throw new Error(RESUME_GONE);
      }
    }, nickname());
  }, [resumable, connect, nickname]);
  const retry = useCallback(() => {
    const attempt = lastAttempt.current;
    if (attempt) connect(attempt.run, attempt.nickname);
  }, [connect]);

  // Rejection messages disappear by themselves.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const errorCodesRef = useRef(errorCodes);

  /** Sends one command at a time; a rejection becomes a notice. */
  const command = useCallback(async (cmd: string, payload: unknown) => {
    const room = roomRef.current;
    if (!room || pendingRef.current) return undefined;
    pendingRef.current = true;
    setPending(true);
    setNotice(undefined);
    let result: CommandResult;
    try {
      result = (await room.request(cmd, payload)) as CommandResult;
    } catch (err) {
      // No reply (connection lost mid-request): nothing changed on the server as far as we know.
      log.warn("client.warn", { kind: "command", cmd }, err instanceof Error ? err.message : String(err));
      result = { ok: false, code: "INTERNAL_ERROR" };
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
    if (!result.ok) {
      log.warn("client.cmd.rejected", { cmd, code: result.code });
      setNotice(noticeKey(result.code, errorCodesRef.current));
    }
    return result;
  }, []);

  const start = useCallback(() => command("start", {}), [command]);
  const addBot = useCallback((seat: number) => command("addBot", { seat }), [command]);
  const removeBot = useCallback((seat: number) => command("removeBot", { seat }), [command]);
  const kick = useCallback((seat: number) => command("kick", { seat }), [command]);
  const setSpeed = useCallback((speed: BotSpeed) => command("setSpeed", { speed }), [command]);
  const undo = useCallback(() => command("undo", {}), [command]);
  const setAutoplay = useCallback((on: boolean) => command("setAutoplay", { on }), [command]);

  /**
   * Moves to the rematch game once its id is synced: asks for it first if nobody has, then waits for
   * the id (up to REMATCH_WAIT_MS) and joins it under the player's name in this game.
   */
  const rematch = useCallback(() => {
    const room = roomRef.current;
    if (!room || rematching) return;
    setRematching(true);
    let name = "";
    room.state.players?.forEach((p, id) => {
      if (id === room.sessionId) name = p.name ?? "";
    });
    const nick = name || nickname();
    /** Joins the rematch game if its id has arrived; true once done (or this room is gone). */
    const go = () => {
      if (roomRef.current !== room) return true;
      const id = room.state.rematchRoomId;
      if (!id) return false;
      connect(() => getConnector().joinById(id, { nickname: nick }), nick);
      return true;
    };
    if (go()) return;
    void command("rematch", {}).then((result) => {
      if (roomRef.current !== room) return;
      if (!result?.ok) {
        setRematching(false);
        return;
      }
      const since = Date.now();
      const timer = setInterval(() => {
        if (go()) clearInterval(timer);
        else if (Date.now() - since > REMATCH_WAIT_MS) {
          clearInterval(timer);
          setRematching(false);
        }
      }, 100);
    });
  }, [rematching, command, nickname, connect]);

  // Online: this browser computes the bots' moves while it is the bot runner.
  useBotRunner(status === "playing" ? activeRoom : undefined, view, definition.askBot);

  /**
   * Leaves locally first: the start screen shows at once, and no late callback or reconnect
   * through Render's proxy can bring the game back. The server still hears the leave.
   */
  const leave = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    detach();
    setStartNotice(undefined);
    quit(room);
  }, [detach]);

  return {
    status,
    view,
    slow: status === "connecting" && slow,
    createGame,
    joinById,
    playBots,
    undo,
    joinInvite,
    watch,
    watchBots,
    setSpeed,
    setAutoplay,
    rematch,
    rematching,
    nickname,
    resumable,
    resume,
    retry,
    start,
    addBot,
    removeBot,
    kick,
    command,
    leave,
    startNotice,
    pending,
    notice,
  };
}

import { resolve } from "node:path";
import pino, { type DestinationStream, type Logger } from "pino";
import pretty from "pino-pretty";
import type { ClientLogEntry, LogLevel } from "@game-kit/protocol";
import type { ServerLogEvent } from "./events.js";

/** Extra fields of a log line. `room` and `player` are placed right after `evt`. */
export type LogFields = { room?: string; player?: string; err?: unknown } & Record<string, unknown>;

type Mode = "production" | "development" | "test";

/** Where shipped lines go: the Axiom dataset, an ingest token and the dataset's edge region. */
export interface AxiomOptions {
  dataset: string;
  token: string;
  /** Edge domain of the dataset's region (e.g. `eu-central-1.aws.edge.axiom.co`); Axiom refuses ingest elsewhere. */
  edge?: string;
}

export interface LoggerOptions {
  env?: NodeJS.ProcessEnv;
  /** Write here instead of the mode's default output (tests). */
  destination?: DestinationStream;
  /** Builds the stream that ships lines to Axiom; tests replace it (no network). */
  axiomStream?: (options: AxiomOptions) => DestinationStream;
}

/** The official pino transport: a worker thread that batches lines to Axiom, off the event loop. */
const axiomTransport = (options: AxiomOptions): DestinationStream => pino.transport({ target: "@axiomhq/pino", options });

/** Axiom settings when the production server should ship its lines; never in development or tests. */
export function axiomOptionsOf(env: NodeJS.ProcessEnv): AxiomOptions | undefined {
  const { AXIOM_TOKEN: token, AXIOM_DATASET: dataset, AXIOM_EDGE: edge } = env;
  if (modeOf(env) !== "production" || !token || !dataset) return undefined;
  return edge ? { dataset, token, edge } : { dataset, token };
}

/** The development log file: `logs/dev.log` in the repository (the server runs in its workspace folder). */
const devLogFile = (env: NodeJS.ProcessEnv) => env.DEV_LOG_FILE ?? resolve(process.cwd(), "../logs/dev.log");

function modeOf(env: NodeJS.ProcessEnv): Mode {
  if (env.NODE_ENV === "production") return "production";
  return env.NODE_ENV === "test" ? "test" : "development";
}

const DEFAULT_LEVEL: Record<Mode, string> = { production: "info", development: "debug", test: "silent" };

/** Build version: short git commit on Render, `dev` locally. */
export function serverVersion(env: NodeJS.ProcessEnv = process.env): string {
  return env.RENDER_GIT_COMMIT?.slice(0, 7) || "dev";
}

function devDestination(env: NodeJS.ProcessEnv): DestinationStream {
  return pino.multistream([
    { level: "trace", stream: pretty({ colorize: true, ignore: "src,ver", singleLine: true }) },
    // Sync so the file is always ready, even when the process exits right after an error.
    { level: "trace", stream: pino.destination({ dest: devLogFile(env), mkdir: true, sync: true }) },
  ]);
}

interface LoggerState {
  pino: Logger;
  mode: Mode;
  ver: string;
  /** Lines carry `time`: in development, and when shipped (Axiom orders events by it). */
  timed: boolean;
}

function createPino(options: LoggerOptions): LoggerState {
  const env = options.env ?? process.env;
  const mode = modeOf(env);
  const local = options.destination ?? (mode === "development" ? devDestination(env) : pino.destination(1));
  const axiom = axiomOptionsOf(env);
  // Stdout stays even when shipping: Render's log view is the fallback if Axiom is unreachable.
  const destination = axiom
    ? pino.multistream([{ stream: local }, { stream: (options.axiomStream ?? axiomTransport)(axiom) }])
    : local;
  const logger = pino(
    {
      level: env.LOG_LEVEL ?? DEFAULT_LEVEL[mode],
      // No pid/hostname and no pino timestamp: Render stamps every line; `line()` adds `time` where needed.
      base: undefined,
      timestamp: false,
      messageKey: "msg",
      formatters: { level: (label) => ({ level: label }) },
      serializers: { err: pino.stdSerializers.err },
    },
    destination,
  );
  return { pino: logger, mode, ver: serverVersion(env), timed: mode === "development" || axiom !== undefined };
}

let state = createPino({});

/** Rebuilds the logger, e.g. to capture output in tests. */
export function configureLogger(options: LoggerOptions = {}): void {
  state = createPino(options);
}

/** Orders keys `evt, room, player, …fields, src, ver[, time]` after pino's `level`. */
function line(evt: string, fields: LogFields | undefined, src: "server" | "client", ver: string) {
  const { room, player, ...rest } = fields ?? {};
  const obj: Record<string, unknown> = { evt };
  if (room !== undefined) obj.room = room;
  if (player !== undefined) obj.player = player;
  Object.assign(obj, rest, { src, ver });
  if (state.timed) obj.time = new Date().toISOString();
  return obj;
}

function emit(level: LogLevel, evt: ServerLogEvent, fields?: LogFields, msg?: string) {
  const obj = line(evt, fields, "server", state.ver);
  if (msg === undefined) state.pino[level](obj);
  else state.pino[level](obj, msg);
}

export const log = {
  debug: (evt: ServerLogEvent, fields?: LogFields, msg?: string) => emit("debug", evt, fields, msg),
  info: (evt: ServerLogEvent, fields?: LogFields, msg?: string) => emit("info", evt, fields, msg),
  warn: (evt: ServerLogEvent, fields?: LogFields, msg?: string) => emit("warn", evt, fields, msg),
  error: (evt: ServerLogEvent, fields?: LogFields, msg?: string) => emit("error", evt, fields, msg),
  isLevelEnabled: (level: LogLevel) => state.pino.isLevelEnabled(level),

  /** Writes one entry received from a client, keeping the client's version and clock. */
  client(entry: ClientLogEntry, clientVer: string) {
    const { level, evt, room, player, msg, stack, ts, fields } = entry;
    const obj = line(evt, { room, player, ...fields, stack, ts }, "client", clientVer);
    if (msg === undefined) state.pino[level](obj);
    else state.pino[level](obj, msg);
  },
};

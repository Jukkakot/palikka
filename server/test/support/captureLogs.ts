import { configureLogger } from "../../src/logging/logger.js";

export interface LogLine {
  level: string;
  evt: string;
  [key: string]: unknown;
}

/** Routes the logger into memory; returns the parsed lines plus the raw text. */
export function captureLogs(env: NodeJS.ProcessEnv = { NODE_ENV: "test", LOG_LEVEL: "debug" }) {
  const raw: string[] = [];
  configureLogger({
    env,
    destination: {
      write(chunk: string) {
        raw.push(...chunk.split("\n").filter(Boolean));
      },
    },
  });
  const lines = () => raw.map((l) => JSON.parse(l) as LogLine);
  return {
    raw,
    lines,
    byEvt: (evt: string) => lines().filter((l) => l.evt === evt),
    clear: () => {
      raw.length = 0;
    },
  };
}

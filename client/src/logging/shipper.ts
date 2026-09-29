import { CLIENT_LOG_LIMITS, type ClientLogEntry } from "@labyrinth/protocol";

/** Posts a JSON body; resolves true when the server accepted it. */
export type SendFn = (body: string, keepalive: boolean) => Promise<boolean>;

const MAX_BUFFER = 200;
/** Browsers cap keepalive request bodies at 64 KiB. */
const KEEPALIVE_MAX_BYTES = 60_000;

/**
 * Buffers client log entries and ships them in batches. A failed send keeps
 * the entries (at most MAX_BUFFER, oldest dropped) for the next flush.
 */
export class LogShipper {
  private buffer: ClientLogEntry[] = [];
  private inFlight = false;
  private readonly send: SendFn;
  private readonly ver: string;

  constructor(send: SendFn, ver: string) {
    this.send = send;
    this.ver = ver;
  }

  get pending(): number {
    return this.buffer.length;
  }

  add(entry: ClientLogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
  }

  /** Sends one batch. With `keepalive` (page hiding) the batch is trimmed to the browser limit. */
  async flush({ keepalive = false } = {}): Promise<void> {
    if (this.inFlight || this.buffer.length === 0) return;
    let batch = this.buffer.slice(0, CLIENT_LOG_LIMITS.maxEntries);
    let body = JSON.stringify({ ver: this.ver, entries: batch });
    while (keepalive && body.length > KEEPALIVE_MAX_BYTES && batch.length > 1) {
      batch = batch.slice(0, Math.ceil(batch.length / 2));
      body = JSON.stringify({ ver: this.ver, entries: batch });
    }

    this.inFlight = true;
    this.buffer.splice(0, batch.length);
    let ok = false;
    try {
      ok = await this.send(body, keepalive);
    } catch {
      ok = false;
    } finally {
      this.inFlight = false;
    }
    if (!ok) {
      this.buffer.unshift(...batch);
      if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
    }
  }
}

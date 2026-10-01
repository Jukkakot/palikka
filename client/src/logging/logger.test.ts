import { describe, expect, it, vi } from "vitest";
import { createClientLogger, isDebugMode, LogShipper, toEntry } from "@game-kit/client";

const okSend = () => vi.fn(async (_body: string, _keepalive: boolean) => true);
const shipped = (send: ReturnType<typeof okSend>) =>
  send.mock.calls.flatMap(([body]) => (JSON.parse(body) as { entries: { evt: string; level: string }[] }).entries);

describe("observability › Client log shipping (client side)", () => {
  it("ships warnings, not plain info", async () => {
    const send = okSend();
    const log = createClientLogger({ send, debug: false });
    log.info("client.info", {}, "rendered");
    log.warn("client.warn", {}, "slow");
    await log.flush();

    expect(shipped(send).map((e) => e.evt)).toEqual(["client.warn"]);
  });

  it("ships key events at info level", async () => {
    const send = okSend();
    const log = createClientLogger({ send, debug: false });
    log.info("client.conn.lost");
    await log.flush();

    expect(shipped(send)).toEqual([expect.objectContaining({ evt: "client.conn.lost", level: "info" })]);
  });

  it("Debug a single client: debug mode ships debug entries", async () => {
    const send = okSend();
    const log = createClientLogger({ send, debug: true });
    log.debug("client.debug", { step: 1 });
    await log.flush();

    expect(shipped(send)).toEqual([expect.objectContaining({ evt: "client.debug", level: "debug" })]);
    expect(isDebugMode("?debug=1")).toBe(true);
    expect(isDebugMode("?lng=en")).toBe(false);
  });

  it("flushes immediately on error", async () => {
    const send = okSend();
    const log = createClientLogger({ send, debug: false });
    log.error("client.error", { stack: "Error: x\n at a" }, "x");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(shipped(send)[0]).toMatchObject({ evt: "client.error", msg: "x", stack: "Error: x\n at a" });
  });

  it("keeps entries after a failed send and caps the buffer at 200", async () => {
    const send = vi.fn(async () => false);
    const shipper = new LogShipper(send, "dev");
    for (let i = 0; i < 250; i++) shipper.add(toEntry("warn", "client.warn", { i }, undefined, Date.now()));
    expect(shipper.pending).toBe(200);

    await shipper.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(shipper.pending).toBe(200);

    send.mockResolvedValue(true);
    await shipper.flush();
    expect(shipper.pending).toBe(150);
  });

  it("sanitizes fields to the server's limits", () => {
    const entry = toEntry("warn", "client.warn", { obj: { a: 1 }, long: "x".repeat(600), n: 1 }, "m", 0);
    expect(entry.fields).toEqual({ obj: '{"a":1}', long: "x".repeat(500), n: 1 });
    expect(entry.ts).toBe("1970-01-01T00:00:00.000Z");
  });
});

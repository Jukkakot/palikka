import { describe, expect, it } from "vitest";
import { botWorkerClient, serveBotWorker, type WorkerAnswer, type WorkerLike, type WorkerQuestion, type WorkerScopeLike } from "./index.js";

const double = (n: number) => n * 2;

/** A fake worker whose replies the test sends by hand. */
function fakeWorker() {
  const sent: WorkerQuestion<number>[] = [];
  const worker: WorkerLike<number, number> & { terminated: boolean } = {
    postMessage: (message) => void sent.push(message),
    onmessage: null,
    onerror: null,
    terminated: false,
    terminate() {
      this.terminated = true;
    },
  };
  const reply = (answer: WorkerAnswer<number>) => worker.onmessage!({ data: answer });
  const crash = (message: string) => worker.onerror!({ message, preventDefault: () => {} });
  return { worker, sent, reply, crash };
}

describe("bot worker harness", () => {
  it("serves answers and errors with the question's id", () => {
    const replies: WorkerAnswer<number>[] = [];
    const scope: WorkerScopeLike<number, number> = { postMessage: (m) => void replies.push(m), onmessage: null };
    serveBotWorker(scope, (n) => {
      if (n < 0) throw new Error("negative");
      return double(n);
    });
    scope.onmessage!({ data: { id: 7, request: 4 } });
    scope.onmessage!({ data: { id: 8, request: -1 } });
    expect(replies).toEqual([{ id: 7, result: 8 }, { id: 8, error: "negative" }]);
  });

  it("matches replies to questions by id, in any order, creating the worker once", async () => {
    const fake = fakeWorker();
    let created = 0;
    const ask = botWorkerClient({ create: () => (created++, fake.worker), answer: double });
    const first = ask(1);
    const second = ask(2);
    expect(created).toBe(1);
    fake.reply({ id: fake.sent[1]!.id, result: 40 });
    fake.reply({ id: fake.sent[0]!.id, result: 10 });
    await expect(first).resolves.toBe(10);
    await expect(second).resolves.toBe(40);
  });

  it("answers in the page when the worker reports an error for a question", async () => {
    const fake = fakeWorker();
    const trouble: string[] = [];
    const ask = botWorkerClient({ create: () => fake.worker, answer: double, onTrouble: (t, m) => void trouble.push(`${t}:${m}`) });
    const pending = ask(3);
    fake.reply({ id: fake.sent[0]!.id, error: "boom" });
    await expect(pending).resolves.toBe(6);
    expect(trouble).toEqual(["answer:boom"]);
  });

  it("answers everything pending and later in the page after a crash", async () => {
    const fake = fakeWorker();
    const trouble: string[] = [];
    const ask = botWorkerClient({ create: () => fake.worker, answer: double, onTrouble: (t) => void trouble.push(t) });
    const pending = ask(5);
    fake.crash("gone");
    await expect(pending).resolves.toBe(10);
    expect(fake.worker.terminated).toBe(true);
    await expect(ask(6)).resolves.toBe(12);
    expect(fake.sent).toHaveLength(1);
    expect(trouble).toEqual(["crash"]);
  });

  it("answers in the page where no worker can be created", async () => {
    const none = botWorkerClient({ create: () => undefined, answer: double });
    await expect(none(2)).resolves.toBe(4);
    const trouble: string[] = [];
    const throwing = botWorkerClient({
      create: () => {
        throw new Error("no workers here");
      },
      answer: double,
      onTrouble: (t, m) => void trouble.push(`${t}:${m}`),
    });
    await expect(throwing(3)).resolves.toBe(6);
    await expect(throwing(4)).resolves.toBe(8);
    expect(trouble).toEqual(["create:no workers here"]);
  });
});

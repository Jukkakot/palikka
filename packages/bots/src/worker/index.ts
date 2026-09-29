/**
 * The bot worker harness: answering bot questions in a Web Worker, off the page's UI thread, and
 * falling back to answering in the page when no worker can run (tests, old browsers, a worker that
 * fails to load or crashes), so games never stall. Generic in the question and answer types; the
 * game supplies `answer` and the page creates the worker (bundlers need the worker URL written at
 * the call site). No DOM library types: the few worker members used are declared here.
 */

/** One question from the page: its id comes back with the answer. */
export interface WorkerQuestion<Q> {
  readonly id: number;
  readonly request: Q;
}

export type WorkerAnswer<A> = { readonly id: number; readonly result: A } | { readonly id: number; readonly error: string };

/** The members of a Web Worker the page side uses. */
export interface WorkerLike<Q, A> {
  postMessage(message: WorkerQuestion<Q>): void;
  onmessage: ((event: { data: WorkerAnswer<A> }) => void) | null;
  onerror: ((event: { message: string; preventDefault(): void }) => void) | null;
  terminate(): void;
}

/** The members of the worker's global scope the worker side uses. */
export interface WorkerScopeLike<Q, A> {
  postMessage(message: WorkerAnswer<A>): void;
  onmessage: ((event: { data: WorkerQuestion<Q> }) => void) | null;
}

/** Inside the worker: answers every question, replying with the result or the error message. */
export function serveBotWorker<Q, A>(scope: WorkerScopeLike<Q, A>, answer: (request: Q) => A): void {
  scope.onmessage = (event) => {
    const { id, request } = event.data;
    let reply: WorkerAnswer<A>;
    try {
      reply = { id, result: answer(request) };
    } catch (err) {
      reply = { id, error: err instanceof Error ? err.message : String(err) };
    }
    scope.postMessage(reply);
  };
}

/** Why the harness answered in the page: the worker could not be created, reported an error, or crashed. */
export type WorkerTrouble = "create" | "answer" | "crash";

export interface BotWorkerClientOptions<Q, A> {
  /** Creates the worker; undefined or a throw means no worker (answers then come from the page). */
  readonly create: () => WorkerLike<Q, A> | undefined;
  /** The same answer the worker gives, computed in the page. */
  readonly answer: (request: Q) => A;
  /** Called when the harness falls back to the page, with the reason and message. */
  readonly onTrouble?: (trouble: WorkerTrouble, message: string) => void;
}

/**
 * In the page: `ask(request)` resolves with the worker's answer. The worker is created on first
 * use; where none can run, or once it has crashed, every question is answered in the page instead.
 */
export function botWorkerClient<Q, A>(options: BotWorkerClientOptions<Q, A>): (request: Q) => Promise<A> {
  const { create, answer, onTrouble } = options;
  let worker: WorkerLike<Q, A> | undefined;
  let broken = false;
  let nextId = 1;
  const pending = new Map<number, { resolve(result: A): void; request: Q }>();

  const inPage = (request: Q): Promise<A> => {
    try {
      return Promise.resolve(answer(request));
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const connect = (): WorkerLike<Q, A> | undefined => {
    if (worker || broken) return worker;
    try {
      worker = create();
    } catch (err) {
      onTrouble?.("create", err instanceof Error ? err.message : String(err));
      worker = undefined;
    }
    if (!worker) {
      broken = true;
      return undefined;
    }
    worker.onmessage = (event) => {
      const reply = event.data;
      const entry = pending.get(reply.id);
      if (!entry) return;
      pending.delete(reply.id);
      if ("error" in reply) {
        onTrouble?.("answer", reply.error);
        entry.resolve(answer(entry.request));
      } else {
        entry.resolve(reply.result);
      }
    };
    worker.onerror = (event) => {
      // A worker that cannot load or crashed: answer everything waiting (and from now on) here instead.
      event.preventDefault();
      broken = true;
      worker?.terminate();
      worker = undefined;
      onTrouble?.("crash", event.message);
      for (const [id, entry] of pending) {
        pending.delete(id);
        entry.resolve(answer(entry.request));
      }
    };
    return worker;
  };

  return (request) => {
    const target = connect();
    if (!target) return inPage(request);
    return new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, { resolve, request });
      target.postMessage({ id, request });
    });
  };
}

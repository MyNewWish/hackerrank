// The app's pyright server, kept alive across documents: started lazily on the first `open`, stopped
// and started again as the editor mode changes, restarted once if it crashes or fails to start.
// Free of Electron, so it runs under `bun test`.
import { mkdirSync } from "node:fs";
import { createListeners } from "./listeners";
import {
  NO_COMPLETIONS,
  startPyright,
  type DiagnosticsListener,
  type ForkServer,
  type PyrightSession,
} from "./pyright";

/**
 * `ready`: the server is running or may be started. `unavailable`: it failed twice (crashed or
 * could not start), so no server runs until the host is stopped.
 */
export type LspStatus = "ready" | "unavailable";

/** How many times a server may fail before the host gives up: the first failure restarts it. */
const MAX_FAILURES = 2;

/**
 * A pyright session that starts itself on the first `open`; see `PyrightSession` for each call.
 * Requests answer empty while no server is up, including those in flight when it dies.
 * Diagnostics listeners stay attached across server restarts.
 */
export interface PyrightHost extends Omit<PyrightSession, "onExit"> {
  /**
   * Stops the server, if any, and forgets earlier failures; the next `open` starts a new one.
   * Open documents are forgotten too: the editor opens them again.
   */
  stop(): void;
  /** Whether a server is running or may be started; see `LspStatus`. */
  status(): LspStatus;
  /** Calls `listener` each time the status changes. Returns a function that removes it. */
  onStatus(listener: (status: LspStatus) => void): () => void;
}

/**
 * `serverEntry` is asked for on each start, so a missing server is a failed start rather than an
 * error. `workspaceDir` holds only pyright's config. `pythonVersion` is asked for when the server
 * starts. Every call waits for the start, so they reach the server in the order they were made.
 */
export function createPyrightHost(options: {
  serverEntry: () => string;
  workspaceDir: string;
  pythonVersion: () => Promise<string | undefined>;
  fork: ForkServer;
  /** See `PyrightOptions.startTimeoutMs`. */
  startTimeoutMs?: number;
}): PyrightHost {
  let session: Promise<PyrightSession | undefined> | undefined;
  /**
   * Bumped by each start and stop, so a server outlived by its generation is stopped as soon as it
   * is up, and its exit cannot clear the session of the server that replaced it.
   */
  let generation = 0;
  /** Set by `dispose`: no server starts after it. */
  let disposed = false;
  /** Crashes and failed starts since the host was created or last stopped. */
  let failures = 0;
  /** Each open document's latest text, sent again to a restarted server. */
  const documents = new Map<string, string>();
  const diagnosticsListeners = createListeners<Parameters<DiagnosticsListener>>();
  const statusListeners = createListeners<[LspStatus]>();
  const status = (): LspStatus => (failures >= MAX_FAILURES ? "unavailable" : "ready");

  /** Counts a failure; true if another server may be started. */
  const fail = (): boolean => {
    failures++;
    if (failures === MAX_FAILURES) statusListeners.emit("unavailable");
    return failures < MAX_FAILURES;
  };

  const startOnce = async (gen: number): Promise<PyrightSession | undefined> => {
    mkdirSync(options.workspaceDir, { recursive: true });
    const started = await startPyright({
      serverEntry: options.serverEntry(),
      workspaceDir: options.workspaceDir,
      pythonVersion: await options.pythonVersion(),
      fork: options.fork,
      startTimeoutMs: options.startTimeoutMs,
    });
    if (gen !== generation) {
      started.dispose();
      return undefined;
    }
    started.onDiagnostics(diagnosticsListeners.emit);
    // Exits not caused by `stop` are crashes: restarted once, with the open documents.
    started.onExit(() => {
      if (gen !== generation) return;
      session = undefined;
      if (fail() && documents.size > 0) void reopenAll();
    });
    return started;
  };
  const start = async (gen: number): Promise<PyrightSession | undefined> => {
    for (;;) {
      try {
        return await startOnce(gen);
      } catch (e) {
        console.error("pyright failed to start:", e);
        if (gen !== generation || !fail()) return undefined;
      }
    }
  };
  const ready = () => {
    if (disposed || status() === "unavailable") return Promise.resolve(undefined);
    return (session ??= start(++generation));
  };
  const reopenAll = async () => {
    const s = await ready();
    if (s) for (const [id, text] of documents) s.open(id, text);
  };
  /** Runs `job` once the server is up, if it has been started; never starts it. */
  const ifStarted = (job: (s: PyrightSession) => void) => void session?.then((s) => s && job(s));
  const stop = () => {
    ifStarted((s) => s.dispose());
    session = undefined;
    generation++;
    documents.clear();
    const wasUnavailable = status() === "unavailable";
    failures = 0;
    // Nothing listens once the app is quitting.
    if (wasUnavailable && !disposed) statusListeners.emit("ready");
  };

  return {
    open(id, text) {
      documents.set(id, text);
      void ready().then((s) => s?.open(id, text));
    },
    change(id, text) {
      if (!documents.has(id)) return;
      documents.set(id, text);
      ifStarted((s) => s.change(id, text));
    },
    close(id) {
      documents.delete(id);
      ifStarted((s) => s.close(id));
    },
    async completion(id, position) {
      const s = await session;
      if (!s) return NO_COMPLETIONS;
      return s.completion(id, position).catch(() => NO_COMPLETIONS);
    },
    async resolveCompletion(item) {
      const s = await session;
      if (!s) return item;
      return s.resolveCompletion(item).catch(() => item);
    },
    async hover(id, position) {
      const s = await session;
      if (!s) return null;
      return s.hover(id, position).catch(() => null);
    },
    async signatureHelp(id, position, context) {
      const s = await session;
      if (!s) return null;
      return s.signatureHelp(id, position, context).catch(() => null);
    },
    onDiagnostics: diagnosticsListeners.add,
    status,
    onStatus: statusListeners.add,
    stop,
    dispose() {
      disposed = true;
      stop();
    },
  };
}

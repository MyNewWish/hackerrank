// The app's pyright server, kept alive across documents: started lazily on the first `open`, stopped
// and started again as the editor mode changes. Free of Electron, so it runs under `bun test`.
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
 * A pyright session that starts itself on the first `open`; see `PyrightSession` for each call.
 * Diagnostics listeners stay attached across server restarts.
 */
export interface PyrightHost extends Omit<PyrightSession, "onExit"> {
  /** Stops the server, if any; the next `open` starts a new one. */
  stop(): void;
}

/**
 * `workspaceDir` holds only pyright's config. `pythonVersion` is asked for when the server starts.
 * Every call waits for the start, so they reach the server in the order they were made.
 */
export function createPyrightHost(options: {
  serverEntry: string;
  workspaceDir: string;
  pythonVersion: () => Promise<string | undefined>;
  fork: ForkServer;
}): PyrightHost {
  let session: Promise<PyrightSession | undefined> | undefined;
  /**
   * Bumped by each start and stop, so a server outlived by its generation is stopped as soon as it
   * is up, and its exit cannot clear the session of the server that replaced it.
   */
  let generation = 0;
  /** Set by `dispose`: no server starts after it. */
  let disposed = false;
  const diagnosticsListeners = createListeners<Parameters<DiagnosticsListener>>();

  const start = async (gen: number): Promise<PyrightSession | undefined> => {
    try {
      mkdirSync(options.workspaceDir, { recursive: true });
      const started = await startPyright({
        serverEntry: options.serverEntry,
        workspaceDir: options.workspaceDir,
        pythonVersion: await options.pythonVersion(),
        fork: options.fork,
      });
      if (gen !== generation) {
        started.dispose();
        return undefined;
      }
      started.onDiagnostics(diagnosticsListeners.emit);
      // A later open starts a fresh server.
      started.onExit(() => {
        if (gen === generation) session = undefined;
      });
      return started;
    } catch (e) {
      console.error("pyright failed to start:", e);
      if (gen === generation) session = undefined;
      return undefined;
    }
  };
  const ready = () => {
    if (disposed) return Promise.resolve(undefined);
    return (session ??= start(++generation));
  };
  /** Runs `job` once the server is up, if it has been started; never starts it. */
  const ifStarted = (job: (s: PyrightSession) => void) => void session?.then((s) => s && job(s));
  const stop = () => {
    ifStarted((s) => s.dispose());
    session = undefined;
    generation++;
  };

  return {
    open: (id, text) => void ready().then((s) => s?.open(id, text)),
    change: (id, text) => ifStarted((s) => s.change(id, text)),
    close: (id) => ifStarted((s) => s.close(id)),
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
    stop,
    dispose() {
      disposed = true;
      stop();
    },
  };
}

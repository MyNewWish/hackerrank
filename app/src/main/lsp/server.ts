// The app's pyright server: started lazily as an Electron utility process the first time an editor
// opens a document, and reached by the renderer only through the `lsp:*` IPC channels.
import { utilityProcess } from "electron";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { NO_COMPLETIONS, startPyright, type ForkServer, type PyrightSession } from "../../lsp/pyright";

const fork: ForkServer = (entry, args, env) => {
  const child = utilityProcess.fork(entry, args, { env, stdio: "ignore", serviceName: "pyright" });
  return { kill: () => void child.kill(), onExit: (listener) => void child.once("exit", listener) };
};

/** A pyright session that starts itself on the first `open`; see `PyrightSession` for each call. */
export type PyrightHost = Omit<PyrightSession, "onExit">;

/**
 * `workspaceDir` holds only pyright's config. `pythonVersion` is asked for when the server starts.
 * Every call waits for the start, so they reach the server in the order they were made.
 */
export function createPyrightHost(options: {
  workspaceDir: string;
  pythonVersion: () => Promise<string | undefined>;
}): PyrightHost {
  let session: Promise<PyrightSession | undefined> | undefined;
  /** Set by `dispose`: a server still starting is stopped as soon as it is up, and none starts after. */
  let disposed = false;

  const start = async (): Promise<PyrightSession | undefined> => {
    try {
      mkdirSync(options.workspaceDir, { recursive: true });
      const started = await startPyright({
        serverEntry: createRequire(import.meta.url).resolve("pyright/langserver.index.js"),
        workspaceDir: options.workspaceDir,
        pythonVersion: await options.pythonVersion(),
        fork,
      });
      if (disposed) {
        started.dispose();
        return undefined;
      }
      // A later open starts a fresh server.
      started.onExit(() => (session = undefined));
      return started;
    } catch (e) {
      console.error("pyright failed to start:", e);
      session = undefined;
      return undefined;
    }
  };
  const ready = () => (disposed ? Promise.resolve(undefined) : (session ??= start()));
  /** Runs `job` once the server is up, if it has been started; never starts it. */
  const ifStarted = (job: (s: PyrightSession) => void) => void session?.then((s) => s && job(s));

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
    dispose() {
      disposed = true;
      ifStarted((s) => s.dispose());
    },
  };
}

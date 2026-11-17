// The app's pyright server as an Electron utility process, reached by the renderer only through the
// `lsp:*` IPC channels.
import { utilityProcess } from "electron";
import { createRequire } from "node:module";
import { createPyrightHost as createHost, type PyrightHost } from "../../lsp/host";
import { unpackedServerEntry, type ForkServer } from "../../lsp/pyright";

export type { PyrightHost };

const fork: ForkServer = (entry, args, env) => {
  const child = utilityProcess.fork(entry, args, { env, stdio: "ignore", serviceName: "pyright" });
  return { kill: () => void child.kill(), onExit: (listener) => void child.once("exit", listener) };
};

/** A pyright host whose server runs in an Electron utility process; see `PyrightHost`. */
export function createPyrightHost(options: {
  workspaceDir: string;
  pythonVersion: () => Promise<string | undefined>;
}): PyrightHost {
  return createHost({
    ...options,
    // Resolved on each start, so a missing server falls back like a crashed one. Packaged builds
    // run the copy unpacked from the app archive (see `asarUnpack` in package.json).
    serverEntry: () => unpackedServerEntry(createRequire(import.meta.url).resolve("pyright/langserver.index.js")),
    fork,
  });
}

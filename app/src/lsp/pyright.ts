// A pyright language server session: starts the server, keeps one in-memory document per question,
// and answers completion requests. Free of Electron, so it runs under `bun test` against the real
// server; the main process supplies an Electron utility process as `fork`.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createClientPipeTransport,
  createMessageConnection,
  generateRandomPipeName,
  type MessageConnection,
} from "vscode-jsonrpc/node";
import type {
  CompletionItem,
  CompletionList,
  CompletionParams,
  ConfigurationParams,
  InitializeParams,
  Position,
} from "vscode-languageserver-protocol";

/** A started server process. */
export interface ServerProcess {
  kill(): void;
  onExit(listener: () => void): void;
}

/** Starts `entry` as a Node program with `args` and environment `env`. */
export type ForkServer = (entry: string, args: string[], env: NodeJS.ProcessEnv) => ServerProcess;

export interface PyrightOptions {
  /** Path to `pyright/langserver.index.js`. */
  serverEntry: string;
  /**
   * A folder the server treats as its workspace. Only `pyrightconfig.json` is written there;
   * documents live in memory under it and are never saved.
   */
  workspaceDir: string;
  /** The interpreter's version, e.g. `3.12.1`; pyright's own default when unknown. */
  pythonVersion: string | undefined;
  fork: ForkServer;
}

export interface PyrightSession {
  /** Opens question `id`'s document with `text`; reopening an open one replaces it. */
  open(id: string, text: string): void;
  /** Replaces the whole text of an open document. */
  change(id: string, text: string): void;
  close(id: string): void;
  /** Completions at a 0-based position; empty for a document that isn't open. */
  completion(id: string, position: Position): Promise<CompletionList>;
  /** Fills in an item's documentation. */
  resolveCompletion(item: CompletionItem): Promise<CompletionItem>;
  /** Called once if the server process exits, whether or not `dispose` caused it. */
  onExit(listener: () => void): void;
  dispose(): void;
}

const ANALYSIS = { typeCheckingMode: "basic" };

/** No completions: the server is down, or the document isn't open. */
export const NO_COMPLETIONS: CompletionList = { isIncomplete: false, items: [] };

/** `3.12.1` → `3.12`, the form pyright's `pythonVersion` takes. */
export function majorMinor(version: string): string | undefined {
  return /^(\d+\.\d+)/.exec(version)?.[1];
}

/**
 * Starts pyright and resolves once it is initialized. The server finds no Python on PATH, so it
 * analyses against its bundled typeshed stdlib stubs only, never the machine's site-packages.
 */
export async function startPyright(options: PyrightOptions): Promise<PyrightSession> {
  const { workspaceDir } = options;
  const pythonVersion = options.pythonVersion && majorMinor(options.pythonVersion);
  writeFileSync(
    join(workspaceDir, "pyrightconfig.json"),
    JSON.stringify({ ...ANALYSIS, ...(pythonVersion && { pythonVersion }) }, null, 2),
  );

  // Electron utility processes cannot pipe stdin, so the server connects back over a named pipe.
  const pipeName = generateRandomPipeName();
  const transport = await createClientPipeTransport(pipeName);
  const server = options.fork(options.serverEntry, [`--pipe=${pipeName}`], withoutPath(process.env));
  const exited = new Promise<void>((resolve) => server.onExit(resolve));
  const [reader, writer] = await Promise.race([
    transport.onConnected(),
    exited.then(() => Promise.reject(new Error("pyright exited before it connected"))),
  ]);
  const connection = createMessageConnection(reader, writer);
  answerServerRequests(connection);
  connection.listen();

  const rootUri = pathToFileURL(workspaceDir).href;
  const initialize: InitializeParams = {
    processId: process.pid,
    rootUri,
    workspaceFolders: [{ uri: rootUri, name: "hackrank" }],
    capabilities: {
      workspace: { configuration: true, workspaceFolders: true },
      textDocument: {
        synchronization: { dynamicRegistration: false },
        completion: {
          completionItem: {
            snippetSupport: false,
            labelDetailsSupport: true,
            documentationFormat: ["markdown", "plaintext"],
            resolveSupport: { properties: ["documentation", "detail"] },
          },
          contextSupport: true,
        },
      },
    },
  };
  await connection.sendRequest("initialize", initialize);
  await connection.sendNotification("initialized", {});

  // Encoded, so no id can name a path outside the workspace.
  const uriOf = (id: string) => pathToFileURL(join(workspaceDir, encodeURIComponent(id), "solution.py")).href;
  /** Each open document's version, which every change must increase. */
  const versions = new Map<string, number>();
  let alive = true;
  void exited.then(() => {
    alive = false;
    connection.dispose();
  });

  const notify = (method: string, params: object) => {
    if (alive) void connection.sendNotification(method, params);
  };
  const close = (id: string) => {
    if (!versions.delete(id)) return;
    notify("textDocument/didClose", { textDocument: { uri: uriOf(id) } });
  };

  return {
    open(id, text) {
      close(id);
      versions.set(id, 1);
      notify("textDocument/didOpen", { textDocument: { uri: uriOf(id), languageId: "python", version: 1, text } });
    },
    change(id, text) {
      const version = versions.get(id);
      if (version === undefined) return;
      versions.set(id, version + 1);
      notify("textDocument/didChange", {
        textDocument: { uri: uriOf(id), version: version + 1 },
        contentChanges: [{ text }],
      });
    },
    close,
    async completion(id, position) {
      if (!alive || !versions.has(id)) return NO_COMPLETIONS;
      const params: CompletionParams = { textDocument: { uri: uriOf(id) }, position };
      const result = await connection.sendRequest<CompletionList | CompletionItem[] | null>(
        "textDocument/completion",
        params,
      );
      if (!result) return NO_COMPLETIONS;
      return Array.isArray(result) ? { isIncomplete: false, items: result } : result;
    },
    async resolveCompletion(item) {
      if (!alive) return item;
      return connection.sendRequest<CompletionItem>("completionItem/resolve", item);
    },
    onExit(listener) {
      void exited.then(listener);
    },
    dispose() {
      if (!alive) return;
      alive = false;
      connection.dispose();
      server.kill();
    },
  };
}

/** Requests the server makes of its client. */
function answerServerRequests(connection: MessageConnection): void {
  connection.onRequest("workspace/configuration", (params: ConfigurationParams) =>
    params.items.map(({ section }) => {
      if (section === "python.analysis") return ANALYSIS;
      if (section === "python") return { analysis: ANALYSIS };
      return null;
    }),
  );
  // Progress reporting and dynamic registration: accepted and ignored.
  connection.onRequest("window/workDoneProgress/create", () => null);
  connection.onRequest("client/registerCapability", () => null);
  connection.onRequest("client/unregisterCapability", () => null);
}

/** `env` without PATH (any case, for Windows), so the server cannot find a Python to run. */
function withoutPath(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([key]) => key.toUpperCase() !== "PATH"));
}

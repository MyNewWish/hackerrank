import { app, BrowserWindow, ipcMain, session } from "electron";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPracticeService } from "../practice";
import { createSettingsStore } from "../settings";
import { CHANNELS, CODE_VIEWS, IDE_MODES, RUN_MODES, type CodeView, type CompletionItem, type IdeMode, type Position, type RunMode, type Settings, type SignatureHelpContext } from "../shared/api";
import { SignatureHelpTriggerKind } from "vscode-languageserver-protocol";
import { createPyrightHost } from "./lsp/server";

const settings = createSettingsStore({
  file: join(app.getPath("userData"), "settings.json"),
  /** Running from the repo, the app folder's sibling `questions/` is the default bank. */
  defaultBankDir: resolve(app.getAppPath(), "..", "questions"),
});

const serviceFor = ({ bankDir, pythonPath }: Settings) =>
  createPracticeService({ bankDir, pythonOverride: pythonPath || undefined });
/** Rebuilt whenever the settings change, so Python is detected again for the new path. */
let service = serviceFor(settings.get());

const pyright = createPyrightHost({
  workspaceDir: join(app.getPath("userData"), "pyright"),
  pythonVersion: async () => {
    const found = await service.detectPython();
    return found.ok ? found.python.version : undefined;
  },
});

const broadcast = (channel: string, ...args: unknown[]) => {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...args);
};
// Pushed to every window; a renderer ignores documents it has no editor for.
pyright.onDiagnostics((id, diagnostics) => broadcast(CHANNELS.lspDiagnostics, id, diagnostics));
pyright.onStatus((status) => broadcast(CHANNELS.lspStatusChanged, status));

/** Set by electron-vite in development: the renderer's dev server. */
const devServerUrl = process.env["ELECTRON_RENDERER_URL"];

function registerIpc(): void {
  const requireString = (value: unknown): string => {
    if (typeof value !== "string") throw new TypeError("expected a string argument");
    return value;
  };
  ipcMain.handle(CHANNELS.listQuestions, () => service.listQuestions());
  ipcMain.handle(CHANNELS.loadQuestion, (_e, id) => service.loadQuestion(requireString(id)));
  const requireView = (value: unknown): CodeView => {
    if (!CODE_VIEWS.includes(value as CodeView)) throw new TypeError("expected a code view");
    return value as CodeView;
  };
  ipcMain.handle(CHANNELS.readCode, (_e, id, view) => service.readCode(requireString(id), requireView(view)));
  ipcMain.handle(CHANNELS.writeCode, (_e, id, view, code) =>
    service.writeCode(requireString(id), requireView(view), requireString(code)),
  );
  // Synchronous IPC returns a value instead of rejecting: undefined on success, else the error message.
  ipcMain.on(CHANNELS.writeCodeSync, (event, id, view, code) => {
    try {
      service.writeCode(requireString(id), requireView(view), requireString(code));
      event.returnValue = undefined;
    } catch (e) {
      event.returnValue = (e as Error).message;
    }
  });
  const requireMode = (value: unknown): RunMode => {
    if (!RUN_MODES.includes(value as RunMode)) throw new TypeError("expected a run mode");
    return value as RunMode;
  };
  ipcMain.handle(CHANNELS.referenceStatus, (_e, id) => service.referenceStatus(requireString(id)));
  ipcMain.handle(CHANNELS.recoverReference, (_e, id) => service.recoverReference(requireString(id)));
  ipcMain.handle(CHANNELS.run, (event, runId, id, view, code, mode) =>
    service.run(requireString(id), requireView(view), requireString(code), requireMode(mode), (result) => {
      if (!event.sender.isDestroyed()) event.sender.send(CHANNELS.runResult, runId, result);
    }),
  );
  ipcMain.handle(CHANNELS.runCustom, (_e, id, view, code, stdin) =>
    service.runCustom(requireString(id), requireView(view), requireString(code), requireString(stdin)),
  );
  ipcMain.handle(CHANNELS.detectPython, () => service.detectPython());
  ipcMain.handle(CHANNELS.getSettings, () => settings.get());
  ipcMain.handle(CHANNELS.updateSettings, (_e, next) => {
    const saved = settings.update(requireSettings(next));
    service = serviceFor(saved);
    stopPyrightUnlessFull(saved.ideMode);
    return saved;
  });
  ipcMain.handle(CHANNELS.setIdeMode, (_e, mode) => {
    const saved = settings.setIdeMode(requireIdeMode(mode));
    stopPyrightUnlessFull(saved.ideMode);
    return saved;
  });
  // Language server traffic: a bad message is dropped rather than answered.
  const lspMessage = <A extends unknown[]>(channel: string, accept: (...args: unknown[]) => A, apply: (...args: A) => void) =>
    ipcMain.on(channel, (_e, ...args: unknown[]) => {
      try {
        apply(...accept(...args));
      } catch {
        // ignored: only the renderer's own bug could send it
      }
    });
  // Only the full IDE starts the server; an open sent while switching away from it is dropped.
  lspMessage(CHANNELS.lspOpen, (id, text) => [requireString(id), requireString(text)] as const, (id, text) => {
    if (settings.get().ideMode === "full") pyright.open(id, text);
  });
  lspMessage(CHANNELS.lspChange, (id, text) => [requireString(id), requireString(text)] as const, pyright.change);
  lspMessage(CHANNELS.lspClose, (id) => [requireString(id)] as const, pyright.close);
  ipcMain.handle(CHANNELS.lspCompletion, (_e, id, position) =>
    pyright.completion(requireString(id), requirePosition(position)),
  );
  ipcMain.handle(CHANNELS.lspResolveCompletion, (_e, item) => pyright.resolveCompletion(requireCompletionItem(item)));
  ipcMain.handle(CHANNELS.lspHover, (_e, id, position) => pyright.hover(requireString(id), requirePosition(position)));
  ipcMain.handle(CHANNELS.lspStatus, () => pyright.status());
  ipcMain.handle(CHANNELS.lspSignatureHelp, (_e, id, position, context) =>
    pyright.signatureHelp(requireString(id), requirePosition(position), requireSignatureHelpContext(context)),
  );
}

function requirePosition(value: unknown): Position {
  const { line, character } = (value ?? {}) as Partial<Record<keyof Position, unknown>>;
  if (!Number.isInteger(line) || !Number.isInteger(character)) throw new TypeError("expected a position");
  return { line: line as number, character: character as number };
}

function requireCompletionItem(value: unknown): CompletionItem {
  if (typeof value !== "object" || value === null || typeof (value as CompletionItem).label !== "string") {
    throw new TypeError("expected a completion item");
  }
  return value as CompletionItem;
}

/** Only the fields pyright reads; a previous help the renderer may hold is not passed on. */
function requireSignatureHelpContext(value: unknown): SignatureHelpContext {
  const { triggerKind, triggerCharacter, isRetrigger } = (value ?? {}) as Partial<Record<keyof SignatureHelpContext, unknown>>;
  const kinds: unknown[] = [
    SignatureHelpTriggerKind.Invoked,
    SignatureHelpTriggerKind.TriggerCharacter,
    SignatureHelpTriggerKind.ContentChange,
  ];
  if (!kinds.includes(triggerKind)) throw new TypeError("expected a signature help context");
  if (triggerCharacter !== undefined && typeof triggerCharacter !== "string") throw new TypeError("expected a trigger character");
  return { triggerKind: triggerKind as SignatureHelpTriggerKind, triggerCharacter, isRetrigger: isRetrigger === true };
}

function requireSettings(value: unknown): Settings {
  const { bankDir, pythonPath, ideMode } = (value ?? {}) as Partial<Record<keyof Settings, unknown>>;
  if (typeof bankDir !== "string" || typeof pythonPath !== "string") throw new TypeError("expected settings");
  return { bankDir, pythonPath, ideMode: requireIdeMode(ideMode) };
}

function requireIdeMode(value: unknown): IdeMode {
  if (!IDE_MODES.includes(value as IdeMode)) throw new TypeError("expected an editor mode");
  return value as IdeMode;
}

/** The HackerRank-like editor has no pyright features, so its server is stopped. */
function stopPyrightUnlessFull(mode: IdeMode): void {
  if (mode === "hackerrank") pyright.stop();
}

/** The app is offline: only its own files (and the dev server in development) may load. */
function blockNetwork(): void {
  // The dev server's host covers both its pages (http:) and its hot-reload socket (ws:).
  const devHost = devServerUrl === undefined ? undefined : new URL(devServerUrl).host;
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const { protocol, host } = new URL(details.url);
    const local = ["file:", "devtools:", "data:", "blob:"].includes(protocol);
    const dev = devHost !== undefined && host === devHost;
    callback({ cancel: !(local || dev) });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "HackerRank",
    autoHideMenuBar: true,
    webPreferences: {
      preload: fileURLToPath(new URL("../preload/index.cjs", import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Links in a statement must not turn the app window into a browser.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());

  if (devServerUrl) void win.loadURL(devServerUrl);
  else void win.loadFile(fileURLToPath(new URL("../renderer/index.html", import.meta.url)));
}

void app.whenReady().then(() => {
  registerIpc();
  blockNetwork();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => pyright.dispose());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

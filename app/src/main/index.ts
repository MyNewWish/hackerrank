import { app, BrowserWindow, ipcMain, session } from "electron";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPracticeService } from "../practice";
import { createSettingsStore } from "../settings";
import { CHANNELS, RUN_MODES, type CompletionItem, type Position, type RunMode, type Settings } from "../shared/api";
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

// Pushed to every window; a renderer ignores documents it has no editor for.
pyright.onDiagnostics((id, diagnostics) => {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(CHANNELS.lspDiagnostics, id, diagnostics);
});

/** Set by electron-vite in development: the renderer's dev server. */
const devServerUrl = process.env["ELECTRON_RENDERER_URL"];

function registerIpc(): void {
  const requireString = (value: unknown): string => {
    if (typeof value !== "string") throw new TypeError("expected a string argument");
    return value;
  };
  ipcMain.handle(CHANNELS.listQuestions, () => service.listQuestions());
  ipcMain.handle(CHANNELS.loadQuestion, (_e, id) => service.loadQuestion(requireString(id)));
  ipcMain.handle(CHANNELS.readSolution, (_e, id) => service.readSolution(requireString(id)));
  ipcMain.handle(CHANNELS.writeSolution, (_e, id, code) =>
    service.writeSolution(requireString(id), requireString(code)),
  );
  // Synchronous IPC returns a value instead of rejecting: undefined on success, else the error message.
  ipcMain.on(CHANNELS.writeSolutionSync, (event, id, code) => {
    try {
      service.writeSolution(requireString(id), requireString(code));
      event.returnValue = undefined;
    } catch (e) {
      event.returnValue = (e as Error).message;
    }
  });
  const requireMode = (value: unknown): RunMode => {
    if (!RUN_MODES.includes(value as RunMode)) throw new TypeError("expected a run mode");
    return value as RunMode;
  };
  ipcMain.handle(CHANNELS.run, (event, runId, id, code, mode) =>
    service.run(requireString(id), requireString(code), requireMode(mode), (result) => {
      if (!event.sender.isDestroyed()) event.sender.send(CHANNELS.runResult, runId, result);
    }),
  );
  ipcMain.handle(CHANNELS.runCustom, (_e, id, code, stdin) =>
    service.runCustom(requireString(id), requireString(code), requireString(stdin)),
  );
  ipcMain.handle(CHANNELS.detectPython, () => service.detectPython());
  ipcMain.handle(CHANNELS.getSettings, () => settings.get());
  ipcMain.handle(CHANNELS.updateSettings, (_e, next) => {
    const saved = settings.update(requireSettings(next));
    service = serviceFor(saved);
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
  lspMessage(CHANNELS.lspOpen, (id, text) => [requireString(id), requireString(text)] as const, pyright.open);
  lspMessage(CHANNELS.lspChange, (id, text) => [requireString(id), requireString(text)] as const, pyright.change);
  lspMessage(CHANNELS.lspClose, (id) => [requireString(id)] as const, pyright.close);
  ipcMain.handle(CHANNELS.lspCompletion, (_e, id, position) =>
    pyright.completion(requireString(id), requirePosition(position)),
  );
  ipcMain.handle(CHANNELS.lspResolveCompletion, (_e, item) => pyright.resolveCompletion(requireCompletionItem(item)));
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

function requireSettings(value: unknown): Settings {
  const { bankDir, pythonPath } = (value ?? {}) as Partial<Record<keyof Settings, unknown>>;
  if (typeof bankDir !== "string" || typeof pythonPath !== "string") throw new TypeError("expected settings");
  return { bankDir, pythonPath };
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
    title: "HackRank",
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

import { app, BrowserWindow, ipcMain, session } from "electron";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPracticeService } from "../practice";
import { CHANNELS, RUN_MODES, type RunMode } from "../shared/api";

/** Running from the repo, the app folder's sibling `questions/` is the bank. */
const bankDir = resolve(app.getAppPath(), "..", "questions");
const service = createPracticeService({ bankDir });

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
  ipcMain.handle(CHANNELS.detectPython, () => service.detectPython());
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

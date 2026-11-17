import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { CHANNELS, type Diagnostic, type GradedTest, type HackrankApi, type LspStatus } from "../shared/api";

let nextRunId = 0;

const api: HackrankApi = {
  listQuestions: () => ipcRenderer.invoke(CHANNELS.listQuestions),
  loadQuestion: (id) => ipcRenderer.invoke(CHANNELS.loadQuestion, id),
  readSolution: (id) => ipcRenderer.invoke(CHANNELS.readSolution, id),
  writeSolution: (id, code) => ipcRenderer.invoke(CHANNELS.writeSolution, id, code),
  writeSolutionSync: (id, code) => {
    const error: unknown = ipcRenderer.sendSync(CHANNELS.writeSolutionSync, id, code);
    if (typeof error === "string") throw new Error(error);
  },
  run: async (id, code, mode, onResult) => {
    // Results of every run arrive on one channel; the run id picks out this run's.
    const runId = ++nextRunId;
    const listener = (_e: IpcRendererEvent, from: unknown, result: GradedTest) => {
      if (from === runId) onResult(result);
    };
    ipcRenderer.on(CHANNELS.runResult, listener);
    try {
      return await ipcRenderer.invoke(CHANNELS.run, runId, id, code, mode);
    } finally {
      ipcRenderer.removeListener(CHANNELS.runResult, listener);
    }
  },
  runCustom: (id, code, stdin) => ipcRenderer.invoke(CHANNELS.runCustom, id, code, stdin),
  detectPython: () => ipcRenderer.invoke(CHANNELS.detectPython),
  getSettings: () => ipcRenderer.invoke(CHANNELS.getSettings),
  updateSettings: (settings) => ipcRenderer.invoke(CHANNELS.updateSettings, settings),
  setIdeMode: (mode) => ipcRenderer.invoke(CHANNELS.setIdeMode, mode),
  // One-way messages, delivered in order with the requests that follow them.
  lspOpen: (id, text) => ipcRenderer.send(CHANNELS.lspOpen, id, text),
  lspChange: (id, text) => ipcRenderer.send(CHANNELS.lspChange, id, text),
  lspClose: (id) => ipcRenderer.send(CHANNELS.lspClose, id),
  lspCompletion: (id, position) => ipcRenderer.invoke(CHANNELS.lspCompletion, id, position),
  lspResolveCompletion: (item) => ipcRenderer.invoke(CHANNELS.lspResolveCompletion, item),
  lspHover: (id, position) => ipcRenderer.invoke(CHANNELS.lspHover, id, position),
  lspSignatureHelp: (id, position, context) => ipcRenderer.invoke(CHANNELS.lspSignatureHelp, id, position, context),
  onLspDiagnostics: (listener) => {
    const relay = (_e: IpcRendererEvent, id: string, diagnostics: Diagnostic[]) => listener(id, diagnostics);
    ipcRenderer.on(CHANNELS.lspDiagnostics, relay);
    return () => void ipcRenderer.removeListener(CHANNELS.lspDiagnostics, relay);
  },
  lspStatus: () => ipcRenderer.invoke(CHANNELS.lspStatus),
  onLspStatus: (listener) => {
    const relay = (_e: IpcRendererEvent, status: LspStatus) => listener(status);
    ipcRenderer.on(CHANNELS.lspStatusChanged, relay);
    return () => void ipcRenderer.removeListener(CHANNELS.lspStatusChanged, relay);
  },
};

contextBridge.exposeInMainWorld("hackrank", api);

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { CHANNELS, type GradedTest, type HackrankApi } from "../shared/api";

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
  detectPython: () => ipcRenderer.invoke(CHANNELS.detectPython),
};

contextBridge.exposeInMainWorld("hackrank", api);

import { contextBridge, ipcRenderer } from "electron";
import { CHANNELS, type HackrankApi } from "../shared/api";

const api: HackrankApi = {
  listQuestions: () => ipcRenderer.invoke(CHANNELS.listQuestions),
  loadQuestion: (id) => ipcRenderer.invoke(CHANNELS.loadQuestion, id),
  readSolution: (id) => ipcRenderer.invoke(CHANNELS.readSolution, id),
  writeSolution: (id, code) => ipcRenderer.invoke(CHANNELS.writeSolution, id, code),
  writeSolutionSync: (id, code) => {
    const error: unknown = ipcRenderer.sendSync(CHANNELS.writeSolutionSync, id, code);
    if (typeof error === "string") throw new Error(error);
  },
  run: (id, code) => ipcRenderer.invoke(CHANNELS.run, id, code),
  detectPython: () => ipcRenderer.invoke(CHANNELS.detectPython),
};

contextBridge.exposeInMainWorld("hackrank", api);

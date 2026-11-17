/// <reference types="vite/client" />
import type { HackrankApi } from "../../shared/api";

declare global {
  interface Window {
    /** The preload API: the renderer's only way to reach files and processes. */
    hackrank: HackrankApi;
  }
}

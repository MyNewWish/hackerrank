/// <reference types="vite/client" />
import type { HackerrankApi } from "../../shared/api";

declare global {
  interface Window {
    /** The preload API: the renderer's only way to reach files and processes. */
    hackerrank: HackerrankApi;
  }
}

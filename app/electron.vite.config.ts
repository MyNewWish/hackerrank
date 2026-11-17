import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {},
  // Sandboxed preload scripts cannot be ES modules.
  preload: { build: { rolldownOptions: { output: { format: "cjs" } } } },
  renderer: { plugins: [react()] },
});

import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  // pyright is run from its own files (unpacked from the app archive), never inlined into main.
  main: { build: { rolldownOptions: { external: ["pyright", /^pyright\//] } } },
  // Sandboxed preload scripts cannot be ES modules.
  preload: { build: { rolldownOptions: { output: { format: "cjs" } } } },
  renderer: { plugins: [react()] },
});

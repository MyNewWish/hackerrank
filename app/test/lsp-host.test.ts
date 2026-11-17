// Integration: the app's pyright host (lazy start, stop, restart) against the real server.
import { afterEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPyrightHost, type PyrightHost } from "../src/lsp/host";
import type { ServerProcess } from "../src/lsp/pyright";

const serverEntry = createRequire(import.meta.url).resolve("pyright/langserver.index.js");

/** Every server process the host started, with whether it has exited. */
let servers: { exited: Promise<void>; hasExited: () => boolean }[] = [];
let host: PyrightHost | undefined;

function makeHost(): PyrightHost {
  host = createPyrightHost({
    serverEntry: () => serverEntry,
    workspaceDir: mkdtempSync(join(tmpdir(), "pyright-host-test-")),
    pythonVersion: async () => "3.12",
    fork: (entry, args, env): ServerProcess => {
      const child = spawn(process.execPath, [entry, ...args], { env, stdio: "ignore" });
      let exited = false;
      const exit = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      void exit.then(() => (exited = true));
      servers.push({ exited: exit, hasExited: () => exited });
      return { kill: () => child.kill(), onExit: (listener) => void exit.then(listener) };
    },
  });
  return host;
}

afterEach(async () => {
  host?.dispose();
  await Promise.all(servers.map((s) => s.exited));
  servers = [];
  host = undefined;
});

const labels = (items: { label: string }[]) => items.map((i) => i.label);

test("stop ends the server process, and the next open starts a new one that answers", async () => {
  const host = makeHost();
  host.open("q1", "import sys\nsys.std");
  expect(labels((await host.completion("q1", { line: 1, character: 7 })).items)).toContain("stdout");

  host.stop();
  await servers[0]!.exited;
  expect(labels((await host.completion("q1", { line: 1, character: 7 })).items)).toEqual([]);

  host.open("q1", "import math\nmath.sq");
  const list = await host.completion("q1", { line: 1, character: 7 });
  expect(labels(list.items)).toContain("sqrt");
  expect(servers).toHaveLength(2);
}, 60_000);

test("the stopped server's exit does not forget the server started after it", async () => {
  const host = makeHost();
  host.open("q1", "x = 1\n");
  await host.completion("q1", { line: 0, character: 0 });

  // Restarted before the old process has finished exiting.
  host.stop();
  host.open("q1", "import os\nos.pa");
  await servers[0]!.exited;

  expect(labels((await host.completion("q1", { line: 1, character: 5 })).items)).toContain("path");
  expect(servers).toHaveLength(2);
  expect(servers[1]!.hasExited()).toBe(false);
}, 60_000);

test("stopping while the server is still starting leaves no server running", async () => {
  const host = makeHost();
  host.open("q1", "x = 1\n");
  host.stop();

  expect(labels((await host.completion("q1", { line: 0, character: 0 })).items)).toEqual([]);
  // The server is forked after the Python version is known; it must exit once it is up.
  while (servers.length === 0) await Bun.sleep(20);
  await servers[0]!.exited;
  expect(servers).toHaveLength(1);
}, 60_000);

// Integration: the pyright host recovers from a crashed or unstartable server against the real
// server: restart once, then give up and report the server unavailable.
import { afterEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPyrightHost, type LspStatus, type PyrightHost } from "../src/lsp/host";
import type { ServerProcess } from "../src/lsp/pyright";

const realEntry = createRequire(import.meta.url).resolve("pyright/langserver.index.js");

/** Every server process the host started. */
let servers: { exited: Promise<void>; kill: () => void }[] = [];
let host: PyrightHost | undefined;

function makeHost(
  serverEntry = () => realEntry,
  startTimeoutMs?: number,
): { host: PyrightHost; statuses: LspStatus[] } {
  host = createPyrightHost({
    serverEntry,
    startTimeoutMs,
    workspaceDir: mkdtempSync(join(tmpdir(), "pyright-recovery-test-")),
    pythonVersion: async () => "3.12",
    fork: (entry, args, env): ServerProcess => {
      const child = spawn(process.execPath, [entry, ...args], { env, stdio: "ignore" });
      const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      servers.push({ exited, kill: () => child.kill() });
      return { kill: () => child.kill(), onExit: (listener) => void exited.then(listener) };
    },
  });
  const statuses: LspStatus[] = [];
  host.onStatus((s) => statuses.push(s));
  return { host, statuses };
}

afterEach(async () => {
  host?.dispose();
  await Promise.all(servers.map((s) => s.exited));
  servers = [];
  host = undefined;
});

const labels = (items: { label: string }[]) => items.map((i) => i.label);

/** Kills the newest server and waits for it to exit. */
async function crashNewest(): Promise<void> {
  const server = servers.at(-1)!;
  server.kill();
  await server.exited;
}

async function waitForServers(n: number): Promise<void> {
  while (servers.length < n) await Bun.sleep(20);
}

test("a crashed server restarts with the open document's latest text", async () => {
  const { host, statuses } = makeHost();
  host.open("q1", "x = 1\n");
  await host.completion("q1", { line: 0, character: 0 });
  host.change("q1", "import sys\nsys.std");

  await crashNewest();
  await waitForServers(2);

  expect(labels((await host.completion("q1", { line: 1, character: 7 })).items)).toContain("stdout");
  expect(host.status()).toBe("ready");
  expect(statuses).toEqual([]);
}, 60_000);

test("a second crash makes the host unavailable, and it starts no more servers", async () => {
  const { host, statuses } = makeHost();
  host.open("q1", "import sys\nsys.std");
  await host.completion("q1", { line: 1, character: 7 });
  await crashNewest();
  await waitForServers(2);
  await host.completion("q1", { line: 1, character: 7 });
  await crashNewest();

  expect(labels((await host.completion("q1", { line: 1, character: 7 })).items)).toEqual([]);
  expect(host.status()).toBe("unavailable");
  expect(statuses).toEqual(["unavailable"]);
  host.open("q2", "x = 1\n");
  expect(await host.hover("q2", { line: 0, character: 0 })).toBeNull();
  expect(servers).toHaveLength(2);
}, 60_000);

test("a server that cannot start is tried twice, then reported unavailable", async () => {
  const { host, statuses } = makeHost(() => join(tmpdir(), "no-such-pyright", "langserver.index.js"));
  host.open("q1", "x = 1\n");

  expect((await host.completion("q1", { line: 0, character: 0 })).items).toEqual([]);
  expect(host.status()).toBe("unavailable");
  expect(statuses).toEqual(["unavailable"]);
  expect(servers).toHaveLength(2);
}, 60_000);

test("an entry that cannot even be found is reported unavailable, not thrown", async () => {
  const { host } = makeHost(() => {
    throw new Error("Cannot find module 'pyright/langserver.index.js'");
  });
  host.open("q1", "x = 1\n");

  expect((await host.completion("q1", { line: 0, character: 0 })).items).toEqual([]);
  expect(host.status()).toBe("unavailable");
}, 60_000);

test("a server that never connects counts as a failed start once it times out", async () => {
  // A program that runs forever without ever connecting back.
  const hang = join(mkdtempSync(join(tmpdir(), "pyright-hang-")), "hang.js");
  await Bun.write(hang, "setInterval(() => {}, 1000);\n");
  const { host } = makeHost(() => hang, 500);
  host.open("q1", "x = 1\n");

  expect(await host.hover("q1", { line: 0, character: 0 })).toBeNull();
  expect(host.status()).toBe("unavailable");
  expect(servers).toHaveLength(2);
}, 60_000);

test("a request in flight when the server dies resolves empty", async () => {
  const { host } = makeHost();
  host.open("q1", "import sys\nsys.std");
  await host.completion("q1", { line: 1, character: 7 });

  // Killed before the server can answer: the requests are sent, then the process is gone.
  const pending = Promise.all([
    host.completion("q1", { line: 1, character: 7 }),
    host.hover("q1", { line: 1, character: 1 }),
    host.signatureHelp("q1", { line: 1, character: 7 }, { triggerKind: 1, isRetrigger: false }),
  ]);
  servers[0]!.kill();

  const [list, hover, help] = await pending;
  expect(list.items).toEqual([]);
  expect(hover).toBeNull();
  expect(help).toBeNull();
}, 60_000);

test("stop clears the unavailable state, so the next open tries again", async () => {
  let entry = join(tmpdir(), "no-such-pyright", "langserver.index.js");
  const { host, statuses } = makeHost(() => entry);
  host.open("q1", "x = 1\n");
  await host.completion("q1", { line: 0, character: 0 });
  expect(host.status()).toBe("unavailable");

  host.stop();
  expect(host.status()).toBe("ready");
  expect(statuses).toEqual(["unavailable", "ready"]);
  entry = realEntry;
  host.open("q1", "import math\nmath.sq");
  expect(labels((await host.completion("q1", { line: 1, character: 7 })).items)).toContain("sqrt");
}, 60_000);

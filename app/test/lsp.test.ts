// Integration: the real pyright language server, started the way the app starts it.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Diagnostic } from "vscode-languageserver-protocol";
import { startPyright, type PyrightSession } from "../src/lsp/pyright";

const serverEntry = createRequire(import.meta.url).resolve("pyright/langserver.index.js");

let session: PyrightSession;

beforeAll(async () => {
  session = await startPyright({
    serverEntry,
    workspaceDir: mkdtempSync(join(tmpdir(), "pyright-test-")),
    pythonVersion: "3.12",
    // Bun runs the server in a plain child process; the app uses an Electron utility process.
    fork: (entry, args, env) => {
      const child = spawn(process.execPath, [entry, ...args], { env, stdio: "ignore" });
      return { kill: () => child.kill(), onExit: (listener) => child.on("exit", listener) };
    },
  });
}, 60_000);

afterAll(() => session?.dispose());

const labels = (items: { label: string }[]) => items.map((i) => i.label);

test("completes module attributes after a dot", async () => {
  session.open("q1", "import sys\nsys.std");
  const list = await session.completion("q1", { line: 1, character: 7 });
  expect(labels(list.items)).toEqual(expect.arrayContaining(["stdin", "stdout", "stderr"]));
}, 30_000);

test("completes string methods on a literal", async () => {
  session.open("q2", '"abc".');
  const list = await session.completion("q2", { line: 0, character: 6 });
  expect(labels(list.items)).toEqual(expect.arrayContaining(["upper", "split", "strip"]));
}, 30_000);

test("completion sees edits sent with change, not the first text", async () => {
  session.open("q3", "x = 1\n");
  session.change("q3", "import os\nos.pa");
  const list = await session.completion("q3", { line: 1, character: 5 });
  expect(labels(list.items)).toContain("path");
}, 30_000);

test("a closed document can be opened again with new text", async () => {
  session.open("q4", "import sys\n");
  session.close("q4");
  session.open("q4", "import math\nmath.sq");
  const list = await session.completion("q4", { line: 1, character: 7 });
  expect(labels(list.items)).toContain("sqrt");
}, 30_000);

test("resolving a completion item adds its signature as documentation", async () => {
  session.open("q5", "import math\nmath.sqrt");
  const list = await session.completion("q5", { line: 1, character: 9 });
  const sqrt = list.items.find((i) => i.label === "sqrt");
  expect(sqrt).toBeDefined();
  const resolved = await session.resolveCompletion(sqrt!);
  const doc = resolved.documentation;
  const text = typeof doc === "string" ? doc : (doc?.value ?? "");
  expect(text).toContain("def sqrt(");
}, 30_000);

/** The first diagnostics published for `id` that satisfy `accept`. */
function diagnosticsFor(id: string, accept: (d: Diagnostic[]) => boolean): Promise<Diagnostic[]> {
  return new Promise((resolve) => {
    const stop = session.onDiagnostics((from, diagnostics) => {
      if (from !== id || !accept(diagnostics)) return;
      stop();
      resolve(diagnostics);
    });
  });
}

test("an undefined name yields one diagnostic on the name", async () => {
  const published = diagnosticsFor("d1", (d) => d.length > 0);
  session.open("d1", "print(undefined_name)\n");
  const diagnostics = await published;
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]!.range).toEqual({ start: { line: 0, character: 6 }, end: { line: 0, character: 20 } });
  expect(diagnostics[0]!.message).toContain("undefined_name");
}, 30_000);

test("a syntax error yields a diagnostic that clears once a change fixes it", async () => {
  const broken = diagnosticsFor("d2", (d) => d.length > 0);
  session.open("d2", "def f(:\n    pass\n");
  expect((await broken).length).toBeGreaterThan(0);
  const fixed = diagnosticsFor("d2", (d) => d.length === 0);
  session.change("d2", "def f():\n    pass\n");
  expect(await fixed).toEqual([]);
}, 30_000);

test("a call with the wrong arguments yields a diagnostic on the call", async () => {
  const published = diagnosticsFor("d3", (d) => d.length > 0);
  session.open("d3", "len(1, 2)\n");
  const diagnostics = await published;
  expect(diagnostics.some((d) => d.range.start.line === 0)).toBe(true);
}, 30_000);

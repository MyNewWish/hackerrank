import { spawn } from "node:child_process";
import { join } from "node:path";
import { outputsMatch } from "./compare";
import type { PythonInfo } from "./python";
import type { CompareMode, Question, TestCase, TestKind } from "./types";

/** `run` = sample tests of every part; `submit` = every test. */
export type RunMode = "run" | "submit";
export type TestStatus = "pass" | "wrong" | "error";

/** What a finished process produced. Output has CRLF normalised to LF. */
export interface ProcessOutput {
  stdout: string;
  stderr: string;
  /** null when the process could not start or was killed by a signal. */
  exitCode: number | null;
}

export interface TestResult extends ProcessOutput {
  testId: string;
  partId: string;
  kind: TestKind;
  status: TestStatus;
  durationMs: number;
}

export interface Summary {
  total: number;
  passed: number;
  parts: { partId: string; total: number; passed: number }[];
}

export interface RunReport {
  results: TestResult[];
  summary: Summary;
}

export interface RunOptions {
  python: PythonInfo;
  question: Question;
  /** Folder holding `<id>_solution.py`; also the solution's working directory. */
  workspaceDir: string;
  mode: RunMode;
  /** Called as each test finishes, in run order. */
  onResult?: (result: TestResult) => void;
}

/** Path of the solution file for `questionId` inside `workspaceDir`. */
export function solutionPath(workspaceDir: string, questionId: string): string {
  return join(workspaceDir, `${questionId}_solution.py`);
}

/** Runs the question's solution against the tests selected by `mode`, one fresh process per test. */
export async function runQuestion(options: RunOptions): Promise<RunReport> {
  const { python, question, workspaceDir, mode, onResult } = options;
  const solution = solutionPath(workspaceDir, question.id);
  const tests = question.parts.flatMap((p) =>
    p.tests.filter((t) => mode === "submit" || t.kind === "sample"),
  );

  const results: TestResult[] = [];
  for (const test of tests) {
    const result = await runTest(python, solution, workspaceDir, test, question.compare);
    results.push(result);
    onResult?.(result);
  }
  return { results, summary: summarize(question, results) };
}

async function runTest(
  python: PythonInfo,
  solution: string,
  cwd: string,
  test: TestCase,
  compare: CompareMode,
): Promise<TestResult> {
  const started = performance.now();
  const output = await execute(python.path, ["-I", "-u", solution], cwd, test.input);
  const durationMs = Math.round(performance.now() - started);
  const status: TestStatus =
    output.exitCode !== 0 ? "error" : outputsMatch(test.expected, output.stdout, compare) ? "pass" : "wrong";
  return { testId: test.id, partId: test.partId, kind: test.kind, status, ...output, durationMs };
}

function execute(command: string, args: string[], cwd: string, input: string): Promise<ProcessOutput> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    // The solution may exit without reading all of stdin; a broken pipe is not our error.
    child.stdin.on("error", () => {});
    child.on("error", (err) => {
      resolve({ stdout: "", stderr: `failed to start Python: ${err.message}`, exitCode: null });
    });
    child.on("close", (code) => {
      resolve({ stdout: decode(stdout), stderr: decode(stderr), exitCode: code });
    });
    child.stdin.end(input);
  });
}

/** UTF-8 text with CRLF normalised to LF, so Windows output looks like everyone else's. */
function decode(chunks: Buffer[]): string {
  return Buffer.concat(chunks).toString("utf8").replace(/\r\n/g, "\n");
}

function summarize(question: Question, results: TestResult[]): Summary {
  // Every part is listed, even with no selected tests (0/0), so callers can show all parts consistently.
  const parts = question.parts.map((part) => {
    const partResults = results.filter((r) => r.partId === part.id);
    return {
      partId: part.id,
      total: partResults.length,
      passed: partResults.filter((r) => r.status === "pass").length,
    };
  });
  return {
    total: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    parts,
  };
}

import { spawn } from "node:child_process";
import { join } from "node:path";
import { outputsMatch } from "./compare";
import type { PythonInfo } from "./python";
import type { Question, TestCase, TestKind } from "./types";

const OUTPUT_LIMIT_BYTES = 1024 * 1024;

/** `run` = sample tests of every part; `submit` = every test. */
export type RunMode = "run" | "submit";
export type TestStatus = "pass" | "wrong" | "timeout" | "error";

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
  /** Why the runner stopped the process early, e.g. "Time limit exceeded (5000 ms)". */
  note?: string;
}

export interface Summary {
  total: number;
  passed: number;
  parts: { partId: string; total: number; passed: number }[];
}

export interface RunReport {
  /** Finished tests only; a test interrupted by cancellation is not included. */
  results: TestResult[];
  summary: Summary;
  /** True when the run was cancelled before every selected test finished. */
  cancelled: boolean;
}

export interface RunOptions {
  python: PythonInfo;
  question: Question;
  /** Folder holding `<id>_solution.py`; also the solution's working directory. */
  workspaceDir: string;
  mode: RunMode;
  /** Called as each test finishes, in run order. */
  onResult?: (result: TestResult) => void;
  /** Aborting kills the running test's process and starts no further tests. */
  signal?: AbortSignal;
}

/** Path of the solution file for `questionId` inside `workspaceDir`. */
export function solutionPath(workspaceDir: string, questionId: string): string {
  return join(workspaceDir, `${questionId}_solution.py`);
}

/** Runs the question's solution against the tests selected by `mode`, one fresh process per test. */
export async function runQuestion(options: RunOptions): Promise<RunReport> {
  const { python, question, workspaceDir, mode, onResult, signal } = options;
  const solution = solutionPath(workspaceDir, question.id);
  const tests = question.parts.flatMap((p) =>
    p.tests.filter((t) => mode === "submit" || t.kind === "sample"),
  );

  const results: TestResult[] = [];
  for (const test of tests) {
    if (signal?.aborted) break;
    const result = await runTest(python, solution, workspaceDir, test, question, signal);
    if (!result) break;
    results.push(result);
    onResult?.(result);
  }
  const cancelled = results.length < tests.length;
  return { results, summary: summarize(question, results), cancelled };
}

async function runTest(
  python: PythonInfo,
  solution: string,
  cwd: string,
  test: TestCase,
  question: Question,
  signal: AbortSignal | undefined,
): Promise<TestResult | undefined> {
  const started = performance.now();
  const { stopped, ...output } = await execute(python.path, ["-I", "-u", solution], cwd, test.input, {
    timeLimitMs: question.timeLimitMs,
    outputLimitBytes: OUTPUT_LIMIT_BYTES,
    signal,
  });
  const durationMs = Math.round(performance.now() - started);
  const base = { testId: test.id, partId: test.partId, kind: test.kind, ...output, durationMs };
  switch (stopped) {
    case "cancelled":
      return undefined;
    case "timeout":
      return { ...base, status: "timeout", note: `Time limit exceeded (${question.timeLimitMs} ms)` };
    case "output":
      return { ...base, status: "error", note: `Output limit exceeded (${OUTPUT_LIMIT_BYTES / 1024 / 1024} MB per stream)` };
  }
  const status: TestStatus =
    output.exitCode !== 0 ? "error" : outputsMatch(test.expected, output.stdout, question.compare) ? "pass" : "wrong";
  return { ...base, status };
}

interface Limits {
  timeLimitMs: number;
  /** Cap on each of stdout and stderr. */
  outputLimitBytes: number;
  signal: AbortSignal | undefined;
}

/** Why the runner killed a process before it finished on its own. */
type StopReason = "timeout" | "output" | "cancelled";

interface Execution extends ProcessOutput {
  stopped?: StopReason;
}

function execute(command: string, args: string[], cwd: string, input: string, limits: Limits): Promise<Execution> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true,
    });
    let stopped: StopReason | undefined;
    const stop = (reason: StopReason) => {
      if (stopped) return;
      stopped = reason;
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => stop("timeout"), limits.timeLimitMs);
    const onAbort = () => stop("cancelled");
    limits.signal?.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      limits.signal?.removeEventListener("abort", onAbort);
    };
    const stdout = capture(child.stdout, limits.outputLimitBytes, () => stop("output"));
    const stderr = capture(child.stderr, limits.outputLimitBytes, () => stop("output"));
    // The solution may exit without reading all of stdin; a broken pipe is not our error.
    child.stdin.on("error", () => {});
    child.on("error", (err) => {
      cleanup();
      resolve({ stdout: "", stderr: `failed to start Python: ${err.message}`, exitCode: null });
    });
    child.on("close", (code) => {
      cleanup();
      resolve({ stdout: decode(stdout), stderr: decode(stderr), exitCode: code, stopped });
    });
    child.stdin.end(input);
  });
}

/** Collects up to `limit` bytes from `stream`; calls `onOverflow` once more would be needed. */
function capture(stream: NodeJS.ReadableStream, limit: number, onOverflow: () => void): Buffer[] {
  const chunks: Buffer[] = [];
  let size = 0;
  stream.on("data", (chunk: Buffer) => {
    const room = limit - size;
    if (chunk.length > room) {
      if (room <= 0) return onOverflow();
      chunks.push(chunk.subarray(0, room));
      size = limit;
      onOverflow();
      return;
    }
    chunks.push(chunk);
    size += chunk.length;
  });
  return chunks;
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

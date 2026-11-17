import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { outputsMatch } from "./compare";
import type { PythonInfo } from "./python";
import { runsTest, type Question, type RunMode, type TestCase, type TestKind } from "./types";

const OUTPUT_LIMIT_BYTES = 1024 * 1024;
const PIPE_DRAIN_GRACE_MS = 1000;

export type { RunMode };
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
  /** The Python program to grade, e.g. the question's solution file or its reference copy. */
  file: string;
  /** The program's working directory: the workspace. */
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

/** Path of the reference copy for `questionId` inside `workspaceDir`: the candidate's snapshot of the bank's reference. */
export function referencePath(workspaceDir: string, questionId: string): string {
  return join(workspaceDir, `${questionId}_reference.py`);
}

/** Runs `file` against the question's tests selected by `mode`, one fresh process per test. */
export async function runQuestion(options: RunOptions): Promise<RunReport> {
  const { python, question, file, workspaceDir, mode, onResult, signal } = options;
  const tests = question.parts.flatMap((p) =>
    p.tests.filter((t) => runsTest(mode, t.kind)),
  );

  const results: TestResult[] = [];
  for (const test of tests) {
    if (signal?.aborted) break;
    const result = await runTest(python, file, workspaceDir, test, question, signal);
    if (!result) break;
    results.push(result);
    onResult?.(result);
  }
  const cancelled = results.length < tests.length;
  return { results, summary: summarize(question, results), cancelled };
}

async function runTest(
  python: PythonInfo,
  file: string,
  cwd: string,
  test: TestCase,
  question: Question,
  signal: AbortSignal | undefined,
): Promise<TestResult | undefined> {
  const { status, ...run } = await runProgram({
    python,
    file,
    cwd,
    input: test.input,
    timeLimitMs: question.timeLimitMs,
    signal,
  });
  if (status === "cancelled") return undefined;
  const base = { testId: test.id, partId: test.partId, kind: test.kind, ...run };
  if (status !== "ok") return { ...base, status };
  return { ...base, status: outputsMatch(test.expected, run.stdout, question.compare) ? "pass" : "wrong" };
}

/** How a single program run ended: `ok` = exited 0 on its own; `error` = non-zero exit or output limit. */
export type ProgramStatus = "ok" | "error" | "timeout" | "cancelled";

export interface ProgramResult extends ProcessOutput {
  status: ProgramStatus;
  durationMs: number;
  /** Why the runner stopped the process early, e.g. "Time limit exceeded (5000 ms)". */
  note?: string;
}

export interface ProgramOptions {
  python: PythonInfo;
  /** The Python file to run, as `<python> -I -u <file>`. */
  file: string;
  /** Working directory of the process. */
  cwd: string;
  /** Piped to stdin. */
  input: string;
  timeLimitMs: number;
  /** Aborting kills the process; the result then has status `cancelled`. */
  signal?: AbortSignal;
}

/** Runs one Python program on one stdin, under the time and output limits, without grading it. */
export async function runProgram(options: ProgramOptions): Promise<ProgramResult> {
  const { python, file, cwd, input, timeLimitMs, signal } = options;
  const started = performance.now();
  const { stopped, ...output } = await execute(python.path, ["-I", "-u", file], cwd, input, {
    timeLimitMs,
    outputLimitBytes: OUTPUT_LIMIT_BYTES,
    signal,
  });
  const result = { ...output, durationMs: Math.round(performance.now() - started) };
  switch (stopped) {
    case "cancelled":
      return { ...result, status: "cancelled" };
    case "timeout":
      return { ...result, status: "timeout", note: `Time limit exceeded (${timeLimitMs} ms)` };
    case "output":
      return { ...result, status: "error", note: `Output limit exceeded (${OUTPUT_LIMIT_BYTES / 1024 / 1024} MB per stream)` };
  }
  return { ...result, status: output.exitCode === 0 ? "ok" : "error" };
}

/** When the runner must stop a process early. */
interface StopConditions {
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

function execute(
  command: string,
  args: string[],
  cwd: string,
  input: string,
  limits: StopConditions,
): Promise<Execution> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      windowsHide: true,
      // Own process group on POSIX, so the whole tree can be killed at once.
      detached: process.platform !== "win32",
    });
    let settled = false;
    const settle = (execution: Execution) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(execution);
    };
    let exited = false;
    let drainTimer: ReturnType<typeof setTimeout> | undefined;
    child.on("exit", () => {
      exited = true;
      // A leftover descendant may hold the pipes open forever; once the solution itself has
      // exited, give its output a moment to drain, then stop waiting for the pipes to close.
      drainTimer = setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
      }, PIPE_DRAIN_GRACE_MS);
    });
    let stopped: StopReason | undefined;
    let killed = false;
    const stop = (reason: StopReason) => {
      // A process that already exited on its own keeps its real result; we still kill any
      // descendants, since they may be holding the output pipes open.
      if (!exited && !stopped) stopped = reason;
      if (killed) return;
      killed = true;
      killTree(child);
    };
    const timer = setTimeout(() => stop("timeout"), limits.timeLimitMs);
    const onAbort = () => stop("cancelled");
    limits.signal?.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(drainTimer);
      limits.signal?.removeEventListener("abort", onAbort);
    };
    const stdout = capture(child.stdout, limits.outputLimitBytes, () => stop("output"));
    const stderr = capture(child.stderr, limits.outputLimitBytes, () => stop("output"));
    // The solution may exit without reading all of stdin; a broken pipe is not our error.
    child.stdin.on("error", () => {});
    child.on("error", (err) => {
      settle({ stdout: "", stderr: `failed to start Python: ${err.message}`, exitCode: null, stopped });
    });
    child.on("close", (code) => {
      settle({ stdout: decode(stdout), stderr: decode(stderr), exitCode: code, stopped });
    });
    child.stdin.end(input);
  });
}

/**
 * Kills `child` and every process it started. Killing only the direct child is not enough:
 * a grandchild (a solution's own subprocess, or the real interpreter behind a Windows venv
 * launcher) would survive and keep the output pipes open, so the run would never finish.
 */
function killTree(child: ChildProcess): void {
  const { pid } = child;
  if (pid === undefined) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).on(
      "error",
      () => child.kill(),
    );
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
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

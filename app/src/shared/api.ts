// The contract between the renderer and the main process. Only types, constants and pure helpers: safe to import anywhere.
import type { DiscoverResult } from "../judge/python";
import type { RunReport, TestResult, TestStatus } from "../judge/runner";
import type { Difficulty, RunMode, TestKind, ValidationError } from "../judge/types";

export type { DiscoverResult, RunMode, TestKind, TestStatus };
// Pure and dependency-free, so the renderer plans a run by the same rule the judge runs it by.
export { RUN_MODES, runsTest } from "../judge/types";

/** A finished test with the data it was graded on, for the results detail pane. */
export interface GradedTest extends TestResult {
  input: string;
  expected: string;
}

/** A run's report, with each result carrying its test's input and expected output. */
export interface GradedReport extends Omit<RunReport, "results"> {
  results: GradedTest[];
}

export type QuestionSummary =
  | { id: string; ok: true; title: string; difficulty: Difficulty; targetMinutes: number }
  | { id: string; ok: false; folder: string; errors: ValidationError[] };

export interface QuestionView {
  id: string;
  title: string;
  difficulty: Difficulty;
  targetMinutes: number;
  /** `problem.md`, with `## Part N` headings. */
  statement: string;
  /** Each part's tests in run order: ids and kinds only, the test data stays in the main process. */
  parts: { id: string; title: string; tests: { id: string; kind: TestKind }[] }[];
}

/** IPC channel names, one per API method. */
export const CHANNELS = {
  listQuestions: "questions:list",
  loadQuestion: "question:load",
  readSolution: "solution:read",
  writeSolution: "solution:write",
  writeSolutionSync: "solution:write-sync",
  run: "run",
  /** Main → renderer: one finished test of a run, as `(runId, GradedTest)`. */
  runResult: "run:result",
  detectPython: "python:detect",
} as const;

/**
 * Everything the renderer may ask of the main process, exposed as `window.hackrank` by the
 * preload script. The renderer has no other access to files or processes.
 */
export interface HackrankApi {
  listQuestions(): Promise<QuestionSummary[]>;
  loadQuestion(id: string): Promise<QuestionView>;
  /** Empty for a never-attempted question. */
  readSolution(id: string): Promise<string>;
  writeSolution(id: string, code: string): Promise<void>;
  /** Blocks until saved; only for when the window is closing and an async save could be cut off. */
  writeSolutionSync(id: string, code: string): void;
  /**
   * Saves `code`, then grades it: `run` = sample tests only, `submit` = sample and hidden tests.
   * `onResult` is called as each test finishes, before the returned report resolves.
   */
  run(id: string, code: string, mode: RunMode, onResult: (result: GradedTest) => void): Promise<GradedReport>;
  detectPython(): Promise<DiscoverResult>;
}

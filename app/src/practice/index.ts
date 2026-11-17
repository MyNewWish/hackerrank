import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  discoverPython,
  runProgram,
  runQuestion,
  scanBank,
  solutionPath,
  type DiscoverResult,
  type Question,
  type RunMode,
  type TestResult,
} from "../judge";
import type { CustomRunResult, GradedReport, GradedTest, QuestionSummary, QuestionView } from "../shared/api";

export interface PracticeServiceOptions {
  /** The question bank folder; the workspace is its sibling `workspace/` folder. */
  bankDir: string;
  /** Python interpreter to use instead of discovering one. */
  pythonOverride?: string;
}

/**
 * Everything the app's main process does on the user's behalf, free of Electron so it can be
 * tested directly: browse the bank, keep per-question solution files, run them.
 */
export function createPracticeService({ bankDir, pythonOverride }: PracticeServiceOptions) {
  const workspaceDir = join(dirname(bankDir), "workspace");
  let pythonDiscovery: Promise<DiscoverResult> | undefined;

  /** The loaded question `id`, re-read from disk so edits to the bank show up without a restart. */
  function question(id: string): Question {
    const entry = scanBank(bankDir).find((e) => e.id === id);
    if (!entry) throw new Error(`No question "${id}" in ${bankDir}`);
    if (!entry.ok) throw new Error(`Question "${id}" is malformed (${entry.folder})`);
    return entry.question;
  }

  /** Only ids of loadable bank questions get a file, so an id can never point outside the workspace. */
  function solutionFile(id: string): string {
    return solutionPath(workspaceDir, question(id).id);
  }

  /** Saves `code` as the solution for question `id`, creating the workspace if needed. */
  function writeSolution(id: string, code: string): void {
    const file = solutionFile(id);
    mkdirSync(workspaceDir, { recursive: true });
    writeFileSync(file, code);
  }

  /** The interpreter, discovered once per service. */
  function detectPython(): Promise<DiscoverResult> {
    pythonDiscovery ??= discoverPython(pythonOverride);
    return pythonDiscovery;
  }

  /** The interpreter, or an error saying why there is none. */
  async function requirePython() {
    const found = await detectPython();
    if (!found.ok) throw new Error(found.error);
    return found.python;
  }

  return {
    /** Every question folder in numeric order; malformed ones carry their errors. */
    listQuestions(): QuestionSummary[] {
      return scanBank(bankDir).map((entry) =>
        entry.ok
          ? {
              id: entry.id,
              ok: true,
              title: entry.question.title,
              difficulty: entry.question.difficulty,
              targetMinutes: entry.question.targetMinutes,
            }
          : { id: entry.id, ok: false, folder: entry.folder, errors: entry.errors },
      );
    },

    /** What the UI shows for question `id`; test data stays in the main process. */
    loadQuestion(id: string): QuestionView {
      const { title, difficulty, targetMinutes, statement, parts } = question(id);
      return {
        id,
        title,
        difficulty,
        targetMinutes,
        statement,
        parts: parts.map((p) => ({
          id: p.id,
          title: p.title,
          tests: p.tests.map((t) => ({ id: t.id, kind: t.kind })),
        })),
      };
    },

    /** The saved code for question `id`; empty if it was never attempted. */
    readSolution(id: string): string {
      const file = solutionFile(id);
      return existsSync(file) ? readFileSync(file, "utf8") : "";
    },

    writeSolution,
    detectPython,

    /**
     * Saves `code`, then grades it: `run` = the sample tests of every part, `submit` = every test.
     * `onResult` hears about each test as soon as it finishes.
     */
    async run(
      id: string,
      code: string,
      mode: RunMode = "run",
      onResult?: (result: GradedTest) => void,
    ): Promise<GradedReport> {
      writeSolution(id, code);
      const python = await requirePython();
      const q = question(id);
      const tests = new Map(q.parts.flatMap((p) => p.tests).map((t) => [t.id, t]));
      const graded = (result: TestResult): GradedTest => {
        const test = tests.get(result.testId);
        return { ...result, input: test?.input ?? "", expected: test?.expected ?? "" };
      };
      const report = await runQuestion({
        python,
        question: q,
        workspaceDir,
        mode,
        onResult: onResult && ((r) => onResult(graded(r))),
      });
      return { ...report, results: report.results.map(graded) };
    },

    /**
     * Saves `code`, then runs it once on `stdin` with no grading, under the same time limit,
     * output cap and fresh-process rules as a graded test.
     */
    async runCustom(id: string, code: string, stdin: string): Promise<CustomRunResult> {
      writeSolution(id, code);
      const python = await requirePython();
      const q = question(id);
      const result = await runProgram({
        python,
        file: solutionFile(id),
        cwd: workspaceDir,
        input: stdin,
        timeLimitMs: q.timeLimitMs,
      });
      // No signal is passed, so the run is never cancelled.
      if (result.status === "cancelled") throw new Error("Custom run was cancelled");
      return { ...result, status: result.status };
    },
  };
}

export type PracticeService = ReturnType<typeof createPracticeService>;

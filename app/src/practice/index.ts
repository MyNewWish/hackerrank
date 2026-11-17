import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  discoverPython,
  runProgram,
  referencePath,
  runQuestion,
  scanBank,
  solutionPath,
  type DiscoverResult,
  type Question,
  type RunMode,
  type TestResult,
} from "../judge";
import type {
  CodeView,
  CustomRunResult,
  GradedReport,
  GradedTest,
  QuestionSummary,
  QuestionView,
  ReferenceStatus,
} from "../shared/api";

const BANK_REFERENCE = "reference.py";

export interface PracticeServiceOptions {
  /** The question bank folder; the workspace is its sibling `workspace/` folder. */
  bankDir: string;
  /** Python interpreter to use instead of discovering one. */
  pythonOverride?: string;
}

/**
 * Everything the app's main process does on the user's behalf, free of Electron so it can be
 * tested directly: browse the bank, keep per-question solution files and reference copies, run them.
 * The bank is only ever read; everything written goes to the workspace.
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

  /**
   * The workspace file behind `view` of question `id`: `<id>_solution.py` or `<id>_reference.py`.
   * Only ids of loadable bank questions get a file, so an id can never point outside the workspace.
   */
  function codeFile(id: string, view: CodeView): string {
    const { id: checked } = question(id);
    return (view === "solution" ? solutionPath : referencePath)(workspaceDir, checked);
  }

  /** Where question `id`'s `reference.py` lives in the bank (it may be missing). */
  function bankReferenceFile(id: string): string {
    return join(question(id).dir, BANK_REFERENCE);
  }

  /** The bank's `reference.py` for question `id`, or an error saying it has none. */
  function bankReference(id: string): string {
    const file = bankReferenceFile(id);
    if (!existsSync(file)) throw new Error(`Question "${id}" has no ${BANK_REFERENCE} in the question bank`);
    return file;
  }

  /** Copies the bank's `reference.py` over question `id`'s reference copy; returns the copy's path. */
  function copyReference(id: string): string {
    const from = bankReference(id);
    const to = codeFile(id, "reference");
    mkdirSync(workspaceDir, { recursive: true });
    copyFileSync(from, to);
    return to;
  }

  /** Saves `code` as `view` of question `id`, creating the workspace if needed. */
  function writeCode(id: string, view: CodeView, code: string): void {
    const file = codeFile(id, view);
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
              tags: entry.question.tags,
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

    /**
     * The saved code of `view` for question `id`. My solution is empty if never attempted; the
     * reference copy is snapshotted from the bank's `reference.py` on the first read.
     */
    readCode(id: string, view: CodeView): string {
      const file = codeFile(id, view);
      if (existsSync(file)) return readFileSync(file, "utf8");
      return view === "solution" ? "" : readFileSync(copyReference(id), "utf8");
    },

    writeCode,
    detectPython,

    /**
     * Whether question `id`'s reference copy differs from the bank's `reference.py`: false before
     * the first reveal, and false when the bank has no reference to recover from.
     */
    referenceStatus(id: string): ReferenceStatus {
      const copy = codeFile(id, "reference");
      const bank = bankReferenceFile(id);
      if (!existsSync(copy) || !existsSync(bank)) return { modified: false };
      return { modified: !readFileSync(copy).equals(readFileSync(bank)) };
    },

    /** Overwrites question `id`'s reference copy with the bank's current `reference.py`; returns it. */
    recoverReference(id: string): string {
      return readFileSync(copyReference(id), "utf8");
    },

    /**
     * Saves `code` as `view`, then grades that file: `run` = the sample tests of every part, `submit` = every test.
     * `onResult` hears about each test as soon as it finishes.
     */
    async run(
      id: string,
      view: CodeView,
      code: string,
      mode: RunMode = "run",
      onResult?: (result: GradedTest) => void,
    ): Promise<GradedReport> {
      writeCode(id, view, code);
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
        file: codeFile(id, view),
        workspaceDir,
        mode,
        onResult: onResult && ((r) => onResult(graded(r))),
      });
      return { ...report, results: report.results.map(graded) };
    },

    /**
     * Saves `code` as `view`, then runs that file once on `stdin` with no grading, under the same time limit,
     * output cap and fresh-process rules as a graded test.
     */
    async runCustom(id: string, view: CodeView, code: string, stdin: string): Promise<CustomRunResult> {
      writeCode(id, view, code);
      const python = await requirePython();
      const q = question(id);
      const result = await runProgram({
        python,
        file: codeFile(id, view),
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

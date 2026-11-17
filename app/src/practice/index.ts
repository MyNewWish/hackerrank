import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  discoverPython,
  runQuestion,
  scanBank,
  solutionPath,
  type DiscoverResult,
  type Question,
  type RunReport,
} from "../judge";
import type { QuestionSummary, QuestionView } from "../shared/api";

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
        parts: parts.map((p) => ({ id: p.id, title: p.title })),
      };
    },

    /** The saved code for question `id`; empty if it was never attempted. */
    readSolution(id: string): string {
      const file = solutionFile(id);
      return existsSync(file) ? readFileSync(file, "utf8") : "";
    },

    writeSolution,
    detectPython,

    /** Saves `code`, then grades it on the sample tests of every part. */
    async run(id: string, code: string): Promise<RunReport> {
      writeSolution(id, code);
      const found = await detectPython();
      if (!found.ok) throw new Error(found.error);
      return runQuestion({ python: found.python, question: question(id), workspaceDir, mode: "run" });
    },
  };
}

export type PracticeService = ReturnType<typeof createPracticeService>;

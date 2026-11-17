// The contract between the renderer and the main process. Only types and constants: safe to import anywhere.
import type { DiscoverResult } from "../judge/python";
import type { RunReport } from "../judge/runner";
import type { Difficulty, ValidationError } from "../judge/types";

export type { DiscoverResult, RunReport };

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
  parts: { id: string; title: string }[];
}

/** IPC channel names, one per API method. */
export const CHANNELS = {
  listQuestions: "questions:list",
  loadQuestion: "question:load",
  readSolution: "solution:read",
  writeSolution: "solution:write",
  writeSolutionSync: "solution:write-sync",
  run: "run",
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
  /** Saves `code`, then grades it on the sample tests. */
  run(id: string, code: string): Promise<RunReport>;
  detectPython(): Promise<DiscoverResult>;
}

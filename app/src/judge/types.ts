export type Difficulty = "easy" | "medium" | "hard";
/** `float:<eps>` compares whitespace-separated tokens numerically within eps. */
export type CompareMode = "lines" | "exact" | `float:${string}`;
export type TestKind = "sample" | "hidden";

export interface TestCase {
  /** `<partId>/<kind>/<NN>`, e.g. `part1/sample/01`. */
  id: string;
  partId: string;
  kind: TestKind;
  input: string;
  expected: string;
}

export interface Part {
  id: string;
  title: string;
  /** Sample tests first, then hidden; each group ordered by file name. */
  tests: TestCase[];
}

export interface Question {
  /** Folder name up to the first underscore, e.g. `q1`. */
  id: string;
  dir: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  targetMinutes: number;
  timeLimitMs: number;
  compare: CompareMode;
  statement: string;
  parts: Part[];
}

export interface ValidationError {
  /** Path relative to the question folder that the problem concerns. */
  path: string;
  message: string;
}

export type LoadResult =
  | { ok: true; question: Question }
  | { ok: false; errors: ValidationError[] };

/** `run` = sample tests of every part; `submit` = every test. */
export type RunMode = "run" | "submit";
export const RUN_MODES: readonly RunMode[] = ["run", "submit"];

/** Whether a test of `kind` is part of a `mode` run. */
export function runsTest(mode: RunMode, kind: TestKind): boolean {
  return mode === "submit" || kind === "sample";
}

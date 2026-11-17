export type Difficulty = "easy" | "medium" | "hard";
export type CompareMode = "lines";
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

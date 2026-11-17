import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadQuestion,
  outputsMatch,
  runProgram,
  TEST_KINDS,
  type ProgramResult,
  type PythonInfo,
  type ValidationError,
} from "../judge";

/** Generous: gen only needs the reference to finish; `validate` enforces the question's own limit. */
const GEN_TIME_LIMIT_MS = 30_000;
const REFERENCE = "reference.py";
const MISSING_REFERENCE: ValidationError = { path: REFERENCE, message: `${REFERENCE} is missing` };

/** A question folder and the Python that runs its reference solution. */
export interface AuthoringTarget {
  python: PythonInfo;
  questionDir: string;
}

export interface GenerateOptions extends AuthoringTarget {
  /** Regenerate every `.out`, not only the missing ones. */
  force?: boolean;
}

export interface GenerateReport {
  /** `.out` files written, relative to the question folder: by part folder name, sample before hidden. */
  written: string[];
  /** Inputs the reference could not produce an output for; nothing is written for them. */
  failed: ValidationError[];
}

/**
 * Runs `reference.py` on every `tests/<part>/{sample,hidden}/*.in` lacking a `.out` (every one
 * with `force`) and writes the outputs. Works on folders `validate` would still reject, such as
 * ones with missing outputs; it does not check `question.yaml`.
 */
export async function generateOutputs(options: GenerateOptions): Promise<GenerateReport> {
  const { questionDir, force = false } = options;
  const report: GenerateReport = { written: [], failed: [] };
  if (!hasReference(questionDir)) {
    report.failed.push(MISSING_REFERENCE);
    return report;
  }
  for (const inRel of listInputs(questionDir)) {
    const outRel = inRel.replace(/\.in$/, ".out");
    if (!force && existsSync(join(questionDir, outRel))) continue;
    const input = readFileSync(join(questionDir, inRel), "utf8");
    const run = await runReference(options, input, GEN_TIME_LIMIT_MS);
    if (run.status !== "ok") {
      report.failed.push({ path: inRel, message: `reference ${describeFailure(run)}` });
      continue;
    }
    writeFileSync(join(questionDir, outRel), run.stdout);
    report.written.push(outRel);
  }
  return report;
}

/**
 * Everything wrong with a question folder: schema errors, missing outputs, part folders vs
 * declared parts, parts lacking a sample or hidden test, and every test the reference fails.
 * The reference only runs once the folder itself loads. Empty means valid.
 */
export async function validateQuestion(target: AuthoringTarget): Promise<ValidationError[]> {
  const loaded = loadQuestion(target.questionDir);
  if (!loaded.ok) return loaded.errors;
  const { question } = loaded;

  const errors: ValidationError[] = [];
  for (const part of question.parts) {
    for (const kind of TEST_KINDS) {
      if (!part.tests.some((t) => t.kind === kind)) {
        errors.push({ path: `tests/${part.id}/${kind}`, message: `part needs at least one ${kind} test` });
      }
    }
  }
  if (!hasReference(target.questionDir)) return [...errors, MISSING_REFERENCE];

  for (const test of question.parts.flatMap((p) => p.tests)) {
    const run = await runReference(target, test.input, question.timeLimitMs);
    const path = `tests/${test.id}.in`;
    if (run.status !== "ok") {
      errors.push({ path, message: `reference ${describeFailure(run)}` });
    } else if (!outputsMatch(test.expected, run.stdout, question.compare)) {
      errors.push({ path, message: "reference output differs from the .out file (wrong answer)" });
    }
  }
  return errors;
}

function hasReference(questionDir: string): boolean {
  return existsSync(join(questionDir, REFERENCE));
}

/** Runs the question's reference solution on one input, from inside the question folder. */
function runReference(target: AuthoringTarget, input: string, timeLimitMs: number): Promise<ProgramResult> {
  const { python, questionDir } = target;
  return runProgram({ python, file: join(questionDir, REFERENCE), cwd: questionDir, input, timeLimitMs });
}

/** Every `tests/<part>/{sample,hidden}/<name>.in`, relative to the question folder. */
function listInputs(questionDir: string): string[] {
  const inputs: string[] = [];
  for (const part of listDirs(join(questionDir, "tests"))) {
    for (const kind of TEST_KINDS) {
      const kindDir = join(questionDir, "tests", part, kind);
      if (!existsSync(kindDir)) continue;
      for (const file of readdirSync(kindDir).filter((f) => f.endsWith(".in")).sort()) {
        inputs.push(`tests/${part}/${kind}/${file}`);
      }
    }
  }
  return inputs;
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** e.g. `exited with code 1: ValueError: bad line` or `timeout: Time limit exceeded (5000 ms)`. */
function describeFailure(run: ProgramResult): string {
  const lastStderr = run.stderr.trim().split("\n").pop() ?? "";
  const what =
    run.note ??
    (run.status !== "error" ? run.status : run.exitCode === null ? "could not run" : `exited with code ${run.exitCode}`);
  return lastStderr ? `${what}: ${lastStderr}` : what;
}

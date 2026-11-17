import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  CompareMode,
  Difficulty,
  LoadResult,
  Part,
  TestCase,
  TestKind,
  ValidationError,
} from "./types";

const DEFAULT_TIME_LIMIT_MS = 5000;
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const COMPARE_MODES: CompareMode[] = ["lines"];
const TEST_KINDS: TestKind[] = ["sample", "hidden"];

interface Meta {
  title: string;
  difficulty: Difficulty;
  tags: string[];
  targetMinutes: number;
  timeLimitMs: number;
  compare: CompareMode;
  parts: { id: string; title: string }[];
}

/** Loads a `q<N>_<slug>` question folder. Authoring problems are returned as errors, never thrown. */
export function loadQuestion(dir: string): LoadResult {
  const errors: ValidationError[] = [];
  const meta = readMeta(dir, errors);
  const statement = readStatement(dir, errors);
  const parts = meta ? readParts(dir, meta.parts, errors) : [];

  if (!meta || statement === undefined || errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    question: {
      id: basename(dir).split("_")[0]!,
      dir,
      title: meta.title,
      difficulty: meta.difficulty,
      tags: meta.tags,
      targetMinutes: meta.targetMinutes,
      timeLimitMs: meta.timeLimitMs,
      compare: meta.compare,
      statement,
      parts,
    },
  };
}

function readMeta(dir: string, errors: ValidationError[]): Meta | undefined {
  const path = "question.yaml";
  const file = join(dir, path);
  if (!existsSync(file)) {
    errors.push({ path, message: "question.yaml is missing" });
    return undefined;
  }
  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(file, "utf8"));
  } catch (e) {
    errors.push({ path, message: `invalid YAML: ${(e as Error).message}` });
    return undefined;
  }
  if (!isRecord(raw)) {
    errors.push({ path, message: "must be a YAML mapping" });
    return undefined;
  }

  const before = errors.length;
  const fail = (message: string) => errors.push({ path, message });

  if (typeof raw.title !== "string" || raw.title.trim() === "") fail("`title` must be a non-empty string");
  if (!DIFFICULTIES.includes(raw.difficulty as Difficulty)) {
    fail(`\`difficulty\` must be one of ${DIFFICULTIES.join(", ")}`);
  }
  if (!Array.isArray(raw.tags) || !raw.tags.every((t) => typeof t === "string")) {
    fail("`tags` must be a list of strings");
  }
  if (!isPositiveNumber(raw.targetMinutes)) fail("`targetMinutes` must be a positive number");
  if (raw.timeLimitMs !== undefined && !isPositiveNumber(raw.timeLimitMs)) {
    fail("`timeLimitMs` must be a positive number");
  }
  if (raw.compare !== undefined && !COMPARE_MODES.includes(raw.compare as CompareMode)) {
    fail(`\`compare\` must be one of ${COMPARE_MODES.join(", ")}`);
  }

  const parts: { id: string; title: string }[] = [];
  if (!Array.isArray(raw.parts) || raw.parts.length === 0) {
    fail("`parts` must be a non-empty list");
  } else {
    raw.parts.forEach((p, i) => {
      if (!isRecord(p) || typeof p.id !== "string" || typeof p.title !== "string") {
        fail(`parts[${i}] must have string \`id\` and \`title\``);
      } else if (parts.some((q) => q.id === p.id)) {
        fail(`parts[${i}]: duplicate part id "${p.id}"`);
      } else {
        parts.push({ id: p.id, title: p.title });
      }
    });
  }

  if (errors.length > before) return undefined;
  return {
    title: raw.title as string,
    difficulty: raw.difficulty as Difficulty,
    tags: raw.tags as string[],
    targetMinutes: raw.targetMinutes as number,
    timeLimitMs: (raw.timeLimitMs as number | undefined) ?? DEFAULT_TIME_LIMIT_MS,
    compare: (raw.compare as CompareMode | undefined) ?? "lines",
    parts,
  };
}

function readStatement(dir: string, errors: ValidationError[]): string | undefined {
  const file = join(dir, "problem.md");
  if (!existsSync(file)) {
    errors.push({ path: "problem.md", message: "problem.md is missing" });
    return undefined;
  }
  return readFileSync(file, "utf8");
}

function readParts(
  dir: string,
  declared: { id: string; title: string }[],
  errors: ValidationError[],
): Part[] {
  const testsDir = join(dir, "tests");
  const folders = listDirs(testsDir);
  for (const folder of folders) {
    if (!declared.some((p) => p.id === folder)) {
      errors.push({ path: `tests/${folder}`, message: `part folder "${folder}" is not declared in parts` });
    }
  }
  return declared.map(({ id, title }) => {
    if (!folders.includes(id)) {
      errors.push({ path: `tests/${id}`, message: `declared part "${id}" has no tests folder` });
      return { id, title, tests: [] };
    }
    return { id, title, tests: readPartTests(join(testsDir, id), id, errors) };
  });
}

function readPartTests(partDir: string, partId: string, errors: ValidationError[]): TestCase[] {
  for (const folder of listDirs(partDir)) {
    if (!TEST_KINDS.includes(folder as TestKind)) {
      errors.push({ path: `tests/${partId}/${folder}`, message: "only sample/ and hidden/ folders are allowed" });
    }
  }
  const tests: TestCase[] = [];
  for (const kind of TEST_KINDS) {
    const kindDir = join(partDir, kind);
    if (!existsSync(kindDir)) continue;
    const files = readdirSync(kindDir);
    const names = new Set<string>();
    for (const f of files) {
      const m = /^(.+)\.(in|out)$/.exec(f);
      if (m) names.add(m[1]!);
    }
    for (const name of [...names].sort()) {
      const rel = `tests/${partId}/${kind}/${name}`;
      const inFile = join(kindDir, `${name}.in`);
      const outFile = join(kindDir, `${name}.out`);
      if (!existsSync(inFile)) {
        errors.push({ path: `${rel}.out`, message: "has no matching .in file" });
        continue;
      }
      if (!existsSync(outFile)) {
        errors.push({ path: `${rel}.in`, message: "has no matching .out file" });
        continue;
      }
      tests.push({
        id: `${partId}/${kind}/${name}`,
        partId,
        kind,
        input: readFileSync(inFile, "utf8"),
        expected: readFileSync(outFile, "utf8"),
      });
    }
  }
  return tests;
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

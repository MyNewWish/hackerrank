import { existsSync, readdirSync, readFileSync } from "node:fs";
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

/** A part as declared in question.yaml, before its tests are attached. */
type PartDeclaration = Pick<Part, "id" | "title">;

interface Meta {
  title: string;
  difficulty: Difficulty;
  tags: string[];
  targetMinutes: number;
  timeLimitMs: number;
  compare: CompareMode;
  parts: PartDeclaration[];
}

/** The question id encoded in a `q<N>_<slug>` folder name: everything before the first underscore. */
export function questionIdFromFolder(folder: string): string {
  return folder.split("_")[0]!;
}

/** Loads a `q<N>_<slug>` question folder. Authoring problems are returned as errors, never thrown. */
export function loadQuestion(dir: string): LoadResult {
  const errors: ValidationError[] = [];
  try {
    const meta = readMeta(dir, errors);
    const statement = readText(dir, "problem.md", errors);
    const parts = meta ? readParts(dir, meta.parts, errors) : [];

    if (!meta || statement === undefined || errors.length > 0) {
      return { ok: false, errors };
    }
    return {
      ok: true,
      question: {
        id: questionIdFromFolder(basename(dir)),
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
  } catch (e) {
    // Last line of defence: an unexpected file-system failure still becomes a validation error.
    return { ok: false, errors: [...errors, { path: ".", message: (e as Error).message }] };
  }
}

/** Reads `rel` inside `dir`, recording a missing or unreadable file as an error. */
function readText(dir: string, rel: string, errors: ValidationError[]): string | undefined {
  const file = join(dir, rel);
  if (!existsSync(file)) {
    errors.push({ path: rel, message: `${rel} is missing` });
    return undefined;
  }
  try {
    return readFileSync(file, "utf8");
  } catch (e) {
    errors.push({ path: rel, message: `cannot read: ${(e as Error).message}` });
    return undefined;
  }
}

function readMeta(dir: string, errors: ValidationError[]): Meta | undefined {
  const path = "question.yaml";
  const text = readText(dir, path, errors);
  if (text === undefined) return undefined;
  let raw: unknown;
  try {
    raw = parseYaml(text);
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

  const parts: PartDeclaration[] = [];
  if (!Array.isArray(raw.parts) || raw.parts.length === 0) {
    fail("`parts` must be a non-empty list");
  } else {
    raw.parts.forEach((entry, i) => {
      if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.title !== "string") {
        fail(`parts[${i}] must have string \`id\` and \`title\``);
      } else if (parts.some((declared) => declared.id === entry.id)) {
        fail(`parts[${i}]: duplicate part id "${entry.id}"`);
      } else {
        parts.push({ id: entry.id, title: entry.title });
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

function readParts(dir: string, declared: PartDeclaration[], errors: ValidationError[]): Part[] {
  const folders = listDirs(join(dir, "tests"));
  for (const folder of folders) {
    if (!declared.some((part) => part.id === folder)) {
      errors.push({ path: `tests/${folder}`, message: `part folder "${folder}" is not declared in parts` });
    }
  }
  return declared.map(({ id, title }) => {
    if (!folders.includes(id)) {
      errors.push({ path: `tests/${id}`, message: `declared part "${id}" has no tests folder` });
      return { id, title, tests: [] };
    }
    return { id, title, tests: readPartTests(dir, id, errors) };
  });
}

function readPartTests(dir: string, partId: string, errors: ValidationError[]): TestCase[] {
  const partDir = join(dir, "tests", partId);
  for (const folder of listDirs(partDir)) {
    if (!TEST_KINDS.includes(folder as TestKind)) {
      errors.push({ path: `tests/${partId}/${folder}`, message: "only sample/ and hidden/ folders are allowed" });
    }
  }
  const tests: TestCase[] = [];
  for (const kind of TEST_KINDS) {
    const kindDir = join(partDir, kind);
    if (!existsSync(kindDir)) continue;
    const testNames = new Set<string>();
    for (const file of readdirSync(kindDir)) {
      const match = /^(.+)\.(in|out)$/.exec(file);
      if (match) testNames.add(match[1]!);
    }
    for (const name of [...testNames].sort()) {
      const id = `${partId}/${kind}/${name}`;
      const inRel = `tests/${id}.in`;
      const outRel = `tests/${id}.out`;
      if (!existsSync(join(dir, inRel))) {
        errors.push({ path: outRel, message: "has no matching .in file" });
        continue;
      }
      if (!existsSync(join(dir, outRel))) {
        errors.push({ path: inRel, message: "has no matching .out file" });
        continue;
      }
      const input = readText(dir, inRel, errors);
      const expected = readText(dir, outRel, errors);
      if (input === undefined || expected === undefined) continue;
      tests.push({ id, partId, kind, input, expected });
    }
  }
  return tests;
}

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateOutputs, validateQuestion } from "../src/authoring";
import { discoverPython, type PythonInfo } from "../src/judge";
import { makeTree, SUM_REFERENCE, sumQuestionFiles } from "./helpers";

let python: PythonInfo;

beforeAll(async () => {
  const found = await discoverPython();
  if (!found.ok) throw new Error(found.error);
  python = found.python;
});

/** A sum question folder with a reference.py; `drop` lists test files to delete afterwards. */
function sumQuestion(drop: string[] = [], extra: Record<string, string> = {}): string {
  const dir = makeTree({ ...sumQuestionFiles(), "reference.py": SUM_REFERENCE, ...extra });
  for (const rel of drop) rmSync(join(dir, rel));
  return dir;
}

const read = (dir: string, rel: string) => readFileSync(join(dir, rel), "utf8");

describe("generateOutputs", () => {
  test("writes .out only for .in files that lack one", async () => {
    const dir = sumQuestion(["tests/part1/hidden/01.out", "tests/part2/sample/01.out"]);
    writeFileSync(join(dir, "tests/part1/sample/01.out"), "hand-written\n");

    const report = await generateOutputs({ python, questionDir: dir });

    expect(report.written).toEqual(["tests/part1/hidden/01.out", "tests/part2/sample/01.out"]);
    expect(report.failed).toEqual([]);
    expect(read(dir, "tests/part1/hidden/01.out")).toBe("30\n");
    expect(read(dir, "tests/part2/sample/01.out")).toBe("2\n4\n");
    expect(read(dir, "tests/part1/sample/01.out")).toBe("hand-written\n");
  });

  test("with force, regenerates every .out", async () => {
    const dir = sumQuestion();
    writeFileSync(join(dir, "tests/part1/sample/01.out"), "stale\n");

    const report = await generateOutputs({ python, questionDir: dir, force: true });

    expect(report.written).toEqual([
      "tests/part1/sample/01.out",
      "tests/part1/hidden/01.out",
      "tests/part1/hidden/02.out",
      "tests/part2/sample/01.out",
      "tests/part2/hidden/01.out",
    ]);
    expect(read(dir, "tests/part1/sample/01.out")).toBe("3\n");
  });

  test("reports inputs the reference crashes on and writes no .out for them", async () => {
    const dir = sumQuestion(["tests/part1/sample/01.out"], {
      "tests/part1/sample/01.in": "not numbers\n",
    });

    const report = await generateOutputs({ python, questionDir: dir });

    expect(report.written).toEqual([]);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]!.path).toBe("tests/part1/sample/01.in");
    expect(report.failed[0]!.message).toContain("ValueError");
    expect(existsSync(join(dir, "tests/part1/sample/01.out"))).toBe(false);
  });

  test("ignores .in files outside sample/ and hidden/ folders", async () => {
    const dir = sumQuestion([], { "tests/part1/drafts/01.in": "4 4\n" });

    const report = await generateOutputs({ python, questionDir: dir });

    expect(report.written).toEqual([]);
    expect(existsSync(join(dir, "tests/part1/drafts/01.out"))).toBe(false);
  });

  test("reports a missing reference.py", async () => {
    const dir = sumQuestion(["reference.py"]);

    const report = await generateOutputs({ python, questionDir: dir });

    expect(report.failed).toEqual([{ path: "reference.py", message: "reference.py is missing" }]);
  });
});

/** question.yaml for the sum question with the given difficulty. */
const sumYaml = (difficulty: string) =>
  [
    "title: Sum",
    `difficulty: ${difficulty}`,
    "tags: []",
    "targetMinutes: 5",
    "parts:",
    "  - { id: part1, title: A }",
    "  - { id: part2, title: B }",
    "",
  ].join("\n");

describe("validateQuestion", () => {
  test("a well-formed question whose reference passes every test has no errors", async () => {
    expect(await validateQuestion({ python, questionDir: sumQuestion() })).toEqual([]);
  });

  test("reports each test the reference fails, with why", async () => {
    const dir = sumQuestion([], {
      "tests/part1/hidden/02.in": "oops\n",
      "tests/part2/hidden/01.out": "wrong\n",
    });

    const errors = await validateQuestion({ python, questionDir: dir });

    expect(errors.map((e) => e.path)).toEqual(["tests/part1/hidden/02.in", "tests/part2/hidden/01.in"]);
    expect(errors[0]!.message).toContain("ValueError");
    expect(errors[1]!.message).toContain("wrong answer");
  });

  test("reports schema errors without running anything", async () => {
    const dir = sumQuestion([], { "question.yaml": sumYaml("impossible") });

    const errors = await validateQuestion({ python, questionDir: dir });

    expect(errors.map((e) => e.path)).toEqual(["question.yaml"]);
    expect(errors[0]!.message).toContain("difficulty");
  });

  test("reports a missing .out and an undeclared part folder", async () => {
    const dir = sumQuestion(["tests/part1/hidden/01.out"], {
      "tests/part3/sample/01.in": "1 1\n",
      "tests/part3/sample/01.out": "2\n",
    });

    const errors = await validateQuestion({ python, questionDir: dir });

    expect(errors.map((e) => [e.path, e.message])).toEqual([
      ["tests/part3", 'part folder "part3" is not declared in parts'],
      ["tests/part1/hidden/01.in", "has no matching .out file"],
    ]);
  });

  test("requires every part to have at least one sample and one hidden test", async () => {
    const dir = sumQuestion(["tests/part2/hidden/01.in", "tests/part2/hidden/01.out"]);

    const errors = await validateQuestion({ python, questionDir: dir });

    expect(errors).toEqual([{ path: "tests/part2/hidden", message: "part needs at least one hidden test" }]);
  });

  test("reports a missing reference.py", async () => {
    const errors = await validateQuestion({ python, questionDir: sumQuestion(["reference.py"]) });

    expect(errors).toEqual([{ path: "reference.py", message: "reference.py is missing" }]);
  });
});

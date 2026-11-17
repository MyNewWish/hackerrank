import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadQuestion, type CompareMode } from "../src/judge";
import { makeTree, SUM_YAML, sumQuestionFiles } from "./helpers";

describe("loadQuestion", () => {
  test("loads a valid question folder into a typed question", () => {
    const bank = makeTree(sumQuestionFiles("q1_sum/"));
    const result = loadQuestion(join(bank, "q1_sum"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const q = result.question;
    expect(q.id).toBe("q1");
    expect(q.title).toBe("Sum two numbers");
    expect(q.difficulty).toBe("easy");
    expect(q.tags).toEqual(["math", "io"]);
    expect(q.targetMinutes).toBe(10);
    expect(q.timeLimitMs).toBe(5000);
    expect(q.compare).toBe("lines");
    expect(q.statement).toContain("## Part 2");
    expect(q.parts.map((p) => [p.id, p.title])).toEqual([
      ["part1", "One pair"],
      ["part2", "Many pairs"],
    ]);
    const [part1, part2] = q.parts;
    expect(part1!.tests.map((t) => [t.id, t.kind, t.input, t.expected])).toEqual([
      ["part1/sample/01", "sample", "1 2\n", "3\n"],
      ["part1/hidden/01", "hidden", "10 20\n", "30\n"],
      ["part1/hidden/02", "hidden", "-5 5\n", "0\n"],
    ]);
    expect(part2!.tests.map((t) => t.id)).toEqual(["part2/sample/01", "part2/hidden/01"]);
  });

  test("reports invalid YAML as a validation error instead of throwing", () => {
    const dir = makeTree({
      ...sumQuestionFiles(),
      "question.yaml": "title: [unclosed\ndifficulty: easy\n",
    });
    const result = loadQuestion(dir);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.path).toBe("question.yaml");
    expect(result.errors[0]!.message).toMatch(/YAML/);
  });

  test("reports schema errors in question.yaml", () => {
    const dir = makeTree({
      ...sumQuestionFiles(),
      "question.yaml": "title: X\ndifficulty: impossible\ntags: []\ntargetMinutes: 10\nparts: []\n",
    });
    const result = loadQuestion(dir);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const messages = result.errors.map((e) => e.message).join("\n");
    expect(messages).toMatch(/difficulty/);
    expect(messages).toMatch(/parts/);
  });

  test("accepts the exact and float:<eps> compare modes", () => {
    const valid: CompareMode[] = ["exact", "float:1e-6", "float:0", "float:0.25"];
    for (const compare of valid) {
      const result = loadQuestion(makeTree({ ...sumQuestionFiles(), "question.yaml": `${SUM_YAML}compare: "${compare}"\n` }));
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      expect(result.question.compare).toBe(compare);
    }
  });

  test("reports an invalid compare value as a validation error", () => {
    // YAML scalars as written in question.yaml; `12` is a number, not a string
    const invalid = ["fuzzy", '"float"', '"float:"', '"float:abc"', '"float:-1"', '"float:Infinity"', "LINES", "12"];
    for (const compare of invalid) {
      const result = loadQuestion(makeTree({ ...sumQuestionFiles(), "question.yaml": `${SUM_YAML}compare: ${compare}\n` }));

      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.errors).toEqual([{ path: "question.yaml", message: expect.stringContaining("`compare`") }]);
    }
  });

  test("reports a part folder that is not declared in parts", () => {
    const dir = makeTree({
      ...sumQuestionFiles(),
      "tests/part3/sample/01.in": "1 1\n",
      "tests/part3/sample/01.out": "2\n",
    });
    const result = loadQuestion(dir);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      { path: "tests/part3", message: expect.stringMatching(/not declared/) },
    ]);
  });

  test("reports a test input that has no .out file", () => {
    const files = sumQuestionFiles();
    delete files["tests/part2/hidden/01.out"];
    const result = loadQuestion(makeTree(files));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      { path: "tests/part2/hidden/01.in", message: expect.stringMatching(/\.out/) },
    ]);
  });
});

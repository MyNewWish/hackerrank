import { beforeAll, describe, expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  discoverPython,
  loadQuestion,
  runQuestion,
  solutionPath,
  type PythonInfo,
  type Question,
  type TestResult,
} from "../src/judge";
import { makeTree, sumQuestionFiles } from "./helpers";

const SOLUTIONS = join(import.meta.dir, "fixtures", "solutions");

let python: PythonInfo;
let question: Question;

beforeAll(async () => {
  const found = await discoverPython();
  if (!found.ok) throw new Error(found.error);
  python = found.python;
  const loaded = loadQuestion(join(makeTree(sumQuestionFiles("q1_sum/")), "q1_sum"));
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
  question = loaded.question;
});

/** A fresh workspace folder holding `fixture` as the question's solution file. */
function workspaceWith(fixture: string): string {
  const workspace = mkdtempSync(join(tmpdir(), "judge-ws-"));
  copyFileSync(join(SOLUTIONS, fixture), solutionPath(workspace, question.id));
  return workspace;
}

describe("runQuestion", () => {
  test("Run executes only the sample tests of every part", async () => {
    const report = await runQuestion({
      python,
      question,
      workspaceDir: workspaceWith("correct.py"),
      mode: "run",
    });

    expect(report.results.map((r) => [r.testId, r.partId, r.kind, r.status])).toEqual([
      ["part1/sample/01", "part1", "sample", "pass"],
      ["part2/sample/01", "part2", "sample", "pass"],
    ]);
    expect(report.results[1]!.stdout).toBe("2\n4\n");
    expect(report.results[1]!.exitCode).toBe(0);
    expect(report.summary).toEqual({
      total: 2,
      passed: 2,
      parts: [
        { partId: "part1", total: 1, passed: 1 },
        { partId: "part2", total: 1, passed: 1 },
      ],
    });
  });

  test("Submit executes every test, in part order, and reports results as they complete", async () => {
    const streamed: TestResult[] = [];
    const report = await runQuestion({
      python,
      question,
      workspaceDir: workspaceWith("correct.py"),
      mode: "submit",
      onResult: (r) => streamed.push(r),
    });

    expect(report.results.map((r) => r.testId)).toEqual([
      "part1/sample/01",
      "part1/hidden/01",
      "part1/hidden/02",
      "part2/sample/01",
      "part2/hidden/01",
    ]);
    expect(streamed).toEqual(report.results);
    expect(report.results.every((r) => r.status === "pass")).toBe(true);
    expect(report.results.every((r) => r.durationMs >= 0)).toBe(true);
    expect(report.summary).toEqual({
      total: 5,
      passed: 5,
      parts: [
        { partId: "part1", total: 3, passed: 3 },
        { partId: "part2", total: 2, passed: 2 },
      ],
    });
  });

  test("a wrong answer is marked wrong and keeps what was printed", async () => {
    const report = await runQuestion({
      python,
      question,
      workspaceDir: workspaceWith("wrong.py"),
      mode: "submit",
    });

    expect(report.results.map((r) => r.status)).toEqual(["wrong", "wrong", "wrong", "wrong", "wrong"]);
    expect(report.results[0]!.stdout).toBe("-1\n");
    expect(report.results[0]!.exitCode).toBe(0);
    expect(report.summary.passed).toBe(0);
  });

  test("a crash is marked error with its stderr and exit code", async () => {
    const report = await runQuestion({
      python,
      question,
      workspaceDir: workspaceWith("crash.py"),
      mode: "run",
    });

    expect(report.results.map((r) => r.status)).toEqual(["error", "error"]);
    const first = report.results[0]!;
    expect(first.exitCode).toBe(1);
    expect(first.stderr).toContain("ValueError: boom: cannot parse input");
    expect(report.summary).toEqual({
      total: 2,
      passed: 0,
      parts: [
        { partId: "part1", total: 1, passed: 0 },
        { partId: "part2", total: 1, passed: 0 },
      ],
    });
  });

  test("trailing whitespace and trailing blank lines are ignored by the default comparison", async () => {
    const report = await runQuestion({
      python,
      question,
      workspaceDir: workspaceWith("trailing_whitespace.py"),
      mode: "submit",
    });

    expect(report.results[0]!.stdout).toBe("3   \t\n\n\n  \n");
    expect(report.results.map((r) => r.status)).toEqual(["pass", "pass", "pass", "pass", "pass"]);
  });

  test("per-part summaries reflect a mix of passes and failures", async () => {
    const mixed = loadQuestion(
      join(
        makeTree({
          ...sumQuestionFiles("q1_sum/"),
          // a deliberately wrong expected output: correct.py will fail this one test
          "q1_sum/tests/part2/hidden/01.out": "101\n16\n0\n",
        }),
        "q1_sum",
      ),
    );
    if (!mixed.ok) throw new Error(JSON.stringify(mixed.errors));

    const report = await runQuestion({
      python,
      question: mixed.question,
      workspaceDir: workspaceWith("correct.py"),
      mode: "submit",
    });

    expect(report.results.find((r) => r.testId === "part2/hidden/01")!.status).toBe("wrong");
    expect(report.summary).toEqual({
      total: 5,
      passed: 4,
      parts: [
        { partId: "part1", total: 3, passed: 3 },
        { partId: "part2", total: 2, passed: 1 },
      ],
    });
  });

  test("the summary lists every part, with 0/0 for a part that has no selected tests", async () => {
    const files = sumQuestionFiles("q1_sum/");
    delete files["q1_sum/tests/part2/sample/01.in"];
    delete files["q1_sum/tests/part2/sample/01.out"];
    const hiddenOnly = loadQuestion(join(makeTree(files), "q1_sum"));
    if (!hiddenOnly.ok) throw new Error(JSON.stringify(hiddenOnly.errors));

    const report = await runQuestion({
      python,
      question: hiddenOnly.question,
      workspaceDir: workspaceWith("correct.py"),
      mode: "run",
    });

    expect(report.summary).toEqual({
      total: 1,
      passed: 1,
      parts: [
        { partId: "part1", total: 1, passed: 1 },
        { partId: "part2", total: 0, passed: 0 },
      ],
    });
  });

  test("runs the solution with the workspace as its working directory", async () => {
    const workspace = workspaceWith("correct.py");
    writeFileSync(solutionPath(workspace, question.id), "import os\nprint(os.getcwd())\n");

    const report = await runQuestion({ python, question, workspaceDir: workspace, mode: "run" });

    expect(realpathSync(report.results[0]!.stdout.trim())).toBe(realpathSync(workspace));
  });
});

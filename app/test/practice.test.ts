import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createPracticeService } from "../src/practice";
import { makeTree, SUM_REFERENCE, sumQuestionFiles } from "./helpers";

/** A repo-like root holding `questions/` with the given files; returns the bank path. */
function bankWith(files: Record<string, string>): string {
  const prefixed = Object.fromEntries(Object.entries(files).map(([k, v]) => [`questions/${k}`, v]));
  return join(makeTree(prefixed), "questions");
}

describe("practice service", () => {
  test("lists questions in numeric order with title, difficulty and target time", () => {
    const bankDir = bankWith({
      ...sumQuestionFiles("q10_sum/"),
      ...sumQuestionFiles("q2_sum/"),
      "q3_broken/question.yaml": "title: [unterminated\n",
    });
    const service = createPracticeService({ bankDir });

    expect(service.listQuestions()).toEqual([
      { id: "q2", ok: true, title: "Sum two numbers", difficulty: "easy", targetMinutes: 10 },
      { id: "q3", ok: false, folder: "q3_broken", errors: expect.any(Array) },
      { id: "q10", ok: true, title: "Sum two numbers", difficulty: "easy", targetMinutes: 10 },
    ]);
  });

  test("loads a question's statement and ordered parts for display", () => {
    const service = createPracticeService({ bankDir: bankWith(sumQuestionFiles("q1_sum/")) });

    expect(service.loadQuestion("q1")).toEqual({
      id: "q1",
      title: "Sum two numbers",
      difficulty: "easy",
      targetMinutes: 10,
      statement: "# Sum\n\n## Part 1\n\nAdd.\n\n## Part 2\n\nAdd many.\n",
      parts: [
        { id: "part1", title: "One pair" },
        { id: "part2", title: "Many pairs" },
      ],
    });
  });

  test("refuses ids that are not a loadable question in the bank", () => {
    const service = createPracticeService({
      bankDir: bankWith({ ...sumQuestionFiles("q1_sum/"), "q2_broken/question.yaml": "title: [x\n" }),
    });

    expect(() => service.loadQuestion("q9")).toThrow('No question "q9"');
    expect(() => service.loadQuestion("q2")).toThrow('Question "q2" is malformed');
    expect(() => service.loadQuestion("../q1")).toThrow();
  });

  test("a never-attempted question starts with an empty solution", () => {
    const bankDir = bankWith(sumQuestionFiles("q1_sum/"));
    const service = createPracticeService({ bankDir });

    expect(service.readSolution("q1")).toBe("");
    expect(existsSync(join(dirname(bankDir), "workspace"))).toBe(false);
  });

  test("saved code lands in workspace/<id>_solution.py next to the bank and is read back", () => {
    const bankDir = bankWith(sumQuestionFiles("q1_sum/"));
    createPracticeService({ bankDir }).writeSolution("q1", "print(1)\n");

    const file = join(dirname(bankDir), "workspace", "q1_solution.py");
    expect(readFileSync(file, "utf8")).toBe("print(1)\n");
    // A fresh service (an app restart) sees the same code.
    expect(createPracticeService({ bankDir }).readSolution("q1")).toBe("print(1)\n");
  });

  test("never writes a solution for an id outside the bank", () => {
    const service = createPracticeService({ bankDir: bankWith(sumQuestionFiles("q1_sum/")) });

    expect(() => service.writeSolution("../evil", "x")).toThrow();
    expect(() => service.readSolution("q7")).toThrow('No question "q7"');
  });

  test("Run saves the code, then grades it on the sample tests only", async () => {
    const service = createPracticeService({ bankDir: bankWith(sumQuestionFiles("q1_sum/")) });

    const report = await service.run("q1", SUM_REFERENCE);

    expect(service.readSolution("q1")).toBe(SUM_REFERENCE);
    expect(report.results.map((r) => [r.testId, r.status])).toEqual([
      ["part1/sample/01", "pass"],
      ["part2/sample/01", "pass"],
    ]);
    expect([report.summary.passed, report.summary.total]).toEqual([2, 2]);
  });

  test("a solution that only handles one pair passes fewer sample tests", async () => {
    const service = createPracticeService({ bankDir: bankWith(sumQuestionFiles("q1_sum/")) });

    const report = await service.run("q1", "a, b = map(int, input().split())\nprint(a + b)\n");

    expect(report.results.map((r) => r.status)).toEqual(["pass", "wrong"]);
    expect([report.summary.passed, report.summary.total]).toEqual([1, 2]);
  });

  test("without a working Python, detection says why and Run refuses", async () => {
    const service = createPracticeService({
      bankDir: bankWith(sumQuestionFiles("q1_sum/")),
      pythonOverride: "definitely-not-a-python",
    });

    expect(await service.detectPython()).toEqual({ ok: false, error: expect.stringContaining("definitely-not-a-python") });
    await expect(service.run("q1", SUM_REFERENCE)).rejects.toThrow("definitely-not-a-python");
  });
});

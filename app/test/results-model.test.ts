import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createPracticeService } from "../src/practice";
import type { GradedTest, QuestionView } from "../src/shared/api";
import { formatRate, moveSelection, resultsView } from "../src/renderer/src/results-model";
import { makeTree, sumQuestionFiles } from "./helpers";

const QUESTION: QuestionView = {
  id: "q1",
  title: "Sum",
  difficulty: "easy",
  targetMinutes: 10,
  statement: "",
  parts: [
    {
      id: "part1",
      title: "One pair",
      tests: [
        { id: "part1/sample/01", kind: "sample" },
        { id: "part1/hidden/01", kind: "hidden" },
        { id: "part1/hidden/02", kind: "hidden" },
      ],
    },
    {
      id: "part2",
      title: "Many pairs",
      tests: [
        { id: "part2/sample/01", kind: "sample" },
        { id: "part2/hidden/01", kind: "hidden" },
      ],
    },
  ],
};

describe("results model", () => {
  test("before any result arrives, Run lists only the sample tests of each part, pending", () => {
    const view = resultsView(QUESTION, "run", []);

    expect(view.parts.map((p) => [p.partId, p.title, p.rows.map((r) => [r.testId, r.label, r.status])])).toEqual([
      ["part1", "One pair", [["part1/sample/01", "Sample 1", "pending"]]],
      ["part2", "Many pairs", [["part2/sample/01", "Sample 1", "pending"]]],
    ]);
  });

  test("Submit lists every test; finished ones take their status and count toward the pass rates", () => {
    const view = resultsView(QUESTION, "submit", [
      result("part1/sample/01", "pass"),
      result("part1/hidden/01", "timeout"),
      result("part1/hidden/02", "pass"),
      result("part2/sample/01", "error"),
    ]);

    expect(view.parts.map((p) => p.rows.map((r) => [r.label, r.status]))).toEqual([
      [["Sample 1", "pass"], ["Hidden 1", "timeout"], ["Hidden 2", "pass"]],
      [["Sample 1", "error"], ["Hidden 1", "pending"]],
    ]);
    expect(view.parts.map((p) => p.rate)).toEqual([
      { passed: 2, total: 3, finished: 3 },
      { passed: 0, total: 2, finished: 1 },
    ]);
    expect(view.rate).toEqual({ passed: 2, total: 5, finished: 4 });
  });

  test("after a full Submit, the overall and per-part rates match the judge's summary", async () => {
    const bankDir = join(makeTree(sumQuestionFiles("questions/q1_sum/")), "questions");
    const service = createPracticeService({ bankDir });
    // Handles one pair per input, so part1 passes and part2 (several pairs) fails.
    const report = await service.run("q1", "a, b = map(int, input().split())\nprint(a + b)\n", "submit");

    const view = resultsView(service.loadQuestion("q1"), "submit", report.results);

    expect({ passed: view.rate.passed, total: view.rate.total }).toEqual({ passed: 3, total: 5 });
    expect(view.parts.map((p) => ({ partId: p.partId, total: p.rate.total, passed: p.rate.passed }))).toEqual(
      report.summary.parts,
    );
    expect([view.rate.passed, view.rate.total]).toEqual([report.summary.passed, report.summary.total]);
  });

  test("a pass rate reads as passed/total with a percentage that never rounds up to 100%", () => {
    expect(formatRate({ passed: 17, total: 20, finished: 20 })).toBe("17/20 (85%)");
    expect(formatRate({ passed: 199, total: 200, finished: 200 })).toBe("199/200 (99%)");
    expect(formatRate({ passed: 0, total: 0, finished: 0 })).toBe("0/0");
  });

  test("up/down move the selection through every test across parts, stopping at the ends", () => {
    const view = resultsView(QUESTION, "submit", []);

    expect(moveSelection(view, undefined, 1)).toBe("part1/sample/01");
    expect(moveSelection(view, "part1/hidden/02", 1)).toBe("part2/sample/01");
    expect(moveSelection(view, "part2/sample/01", -1)).toBe("part1/hidden/02");
    expect(moveSelection(view, "part2/hidden/01", 1)).toBe("part2/hidden/01");
    expect(moveSelection(view, "part1/sample/01", -1)).toBe("part1/sample/01");
  });
});

function result(testId: string, status: GradedTest["status"]): GradedTest {
  const [partId = "", kind] = testId.split("/");
  return {
    testId,
    partId,
    kind: kind === "hidden" ? "hidden" : "sample",
    status,
    stdout: "",
    stderr: "",
    exitCode: 0,
    durationMs: 1,
    input: "",
    expected: "",
  };
}

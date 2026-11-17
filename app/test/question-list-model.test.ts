import { describe, expect, test } from "bun:test";
import type { Difficulty, QuestionSummary } from "../src/shared/api";
import { isFiltering, moveSelection, NO_FILTER, questionList, type QuestionFilter } from "../src/renderer/src/question-list-model";

const BANK: QuestionSummary[] = [
  ok("q1", "Accept Language", "easy", ["stripe", "parsing"]),
  ok("q2", "Shipping Cost", "medium", ["stripe", "graphs"]),
  { id: "q3", ok: false, folder: "q3_broken_ledger", errors: [{ path: "question.yaml", message: "missing title" }] },
  ok("q4", "Request Routing", "hard", ["parsing", "stripe", "strings"]),
  ok("q10", "Card Ranges", "medium", ["intervals"]),
];

function ids(filter: Partial<QuestionFilter>, selectedId?: string) {
  return questionList(BANK, { ...NO_FILTER, ...filter }, selectedId).visible.map((q) => q.id);
}

describe("question list model", () => {
  test("the query matches a title, ignoring case and surrounding whitespace", () => {
    expect(ids({ query: "  sHiPPing " })).toEqual(["q2"]);
  });

  test("the query matches an id or any tag, in bank order", () => {
    expect(ids({ query: "Q1" })).toEqual(["q1", "q10"]);
    expect(ids({ query: " PARS" })).toEqual(["q1", "q4"]);
  });

  test("selected tags must all be present", () => {
    expect(ids({ tags: ["stripe"] })).toEqual(["q1", "q2", "q4"]);
    expect(ids({ tags: ["stripe", "parsing"] })).toEqual(["q1", "q4"]);
    expect(ids({ tags: ["graphs", "parsing"] })).toEqual([]);
  });

  test("the difficulty must match exactly", () => {
    expect(ids({ difficulty: "medium" })).toEqual(["q2", "q10"]);
  });

  test("a malformed question shows with no filter and matches the query by id or folder only", () => {
    expect(ids({})).toEqual(["q1", "q2", "q3", "q4", "q10"]);
    expect(ids({ query: "q3" })).toEqual(["q3"]);
    expect(ids({ query: "LEDGER" })).toEqual(["q3"]);
    expect(ids({ query: "missing title" })).toEqual([]);
  });

  test("a malformed question is hidden once a tag or difficulty is selected", () => {
    expect(ids({ query: "ledger", tags: ["stripe"] })).toEqual([]);
    expect(ids({ query: "ledger", difficulty: "easy" })).toEqual([]);
  });

  test("counts every question in the bank, and lists its tags sorted and once each whatever the filter", () => {
    const view = questionList(BANK, { query: "routing", tags: ["stripe"] }, undefined);

    expect([view.visible.length, view.total]).toEqual([1, 5]);
    expect(view.tags).toEqual(["graphs", "intervals", "parsing", "strings", "stripe"]);
  });

  test("the selection is kept while its question is visible and cleared once it is filtered out", () => {
    expect(questionList(BANK, { ...NO_FILTER, tags: ["stripe"] }, "q4").selectedId).toBe("q4");
    expect(questionList(BANK, { ...NO_FILTER, tags: ["intervals"] }, "q4").selectedId).toBeUndefined();
    expect(questionList(BANK, { ...NO_FILTER, query: "q3" }, "q3").selectedId).toBe("q3");
    expect(questionList(BANK, NO_FILTER, undefined).selectedId).toBeUndefined();
  });

  test("up/down move the selection through the visible questions only, stopping at the ends", () => {
    const view = questionList(BANK, { ...NO_FILTER, tags: ["stripe"] }, undefined);

    expect(moveSelection(view, undefined, 1)).toBe("q1");
    expect(moveSelection(view, "q2", 1)).toBe("q4");
    expect(moveSelection(view, "q4", -1)).toBe("q2");
    expect(moveSelection(view, "q4", 1)).toBe("q4");
    expect(moveSelection(view, "q1", -1)).toBe("q1");
    expect(moveSelection(questionList(BANK, { ...NO_FILTER, query: "zzz" }, undefined), undefined, 1)).toBeUndefined();
  });

  test("only a non-blank query, a tag or a difficulty counts as filtering", () => {
    expect(isFiltering({ query: "   ", tags: [] })).toBe(false);
    expect(isFiltering({ query: "x", tags: [] })).toBe(true);
    expect(isFiltering({ query: "", tags: ["stripe"] })).toBe(true);
    expect(isFiltering({ query: "", tags: [], difficulty: "easy" })).toBe(true);
  });

  test("query, tags and difficulty combine", () => {
    expect(ids({ query: "r", tags: ["stripe"], difficulty: "hard" })).toEqual(["q4"]);
    expect(ids({ query: "shipping", tags: ["stripe"], difficulty: "hard" })).toEqual([]);
  });
});

function ok(id: string, title: string, difficulty: Difficulty, tags: string[]): QuestionSummary {
  return { id, ok: true, title, difficulty, targetMinutes: 30, tags };
}

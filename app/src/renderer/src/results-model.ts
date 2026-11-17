import { runsTest, type GradedTest, type QuestionView, type RunMode, type TestKind, type TestStatus } from "../../shared/api";

export type RowStatus = TestStatus | "pending";

/** One planned test of a run, with its result once it has finished. */
export interface TestRow {
  testId: string;
  /** e.g. "Sample 1", "Hidden 2". */
  label: string;
  kind: TestKind;
  status: RowStatus;
  result?: GradedTest;
}

/** `passed` of the `total` planned tests; `finished` of them have a result so far. */
export interface PassRate {
  passed: number;
  total: number;
  finished: number;
}

/** One part's planned tests and pass rate. */
export interface PartResults {
  partId: string;
  title: string;
  rows: TestRow[];
  rate: PassRate;
}

/** A run as the results panel shows it: every planned test by part, and the overall pass rate. */
export interface ResultsView {
  parts: PartResults[];
  rate: PassRate;
}

/** The tests `mode` runs for `question`, grouped by part, merged with the `results` so far. */
export function resultsView(question: QuestionView, mode: RunMode, results: GradedTest[]): ResultsView {
  const byId = new Map(results.map((r) => [r.testId, r]));
  const parts = question.parts.map((part) => {
    const planned = part.tests.filter((t) => runsTest(mode, t.kind));
    const counters: Record<TestKind, number> = { sample: 0, hidden: 0 };
    const rows = planned.map((t): TestRow => {
      const result = byId.get(t.id);
      const label = `${t.kind === "sample" ? "Sample" : "Hidden"} ${++counters[t.kind]}`;
      return { testId: t.id, label, kind: t.kind, status: result?.status ?? "pending", result };
    });
    return { partId: part.id, title: part.title, rows, rate: rateOf(rows) };
  });
  return { parts, rate: rateOf(parts.flatMap((p) => p.rows)) };
}

function rateOf(rows: TestRow[]): PassRate {
  return {
    passed: rows.filter((r) => r.status === "pass").length,
    total: rows.length,
    finished: rows.filter((r) => r.status !== "pending").length,
  };
}

/** "17/20 (85%)". The percentage rounds down, so it only reads 100% when every test passed. */
export function formatRate({ passed, total }: PassRate): string {
  if (total === 0) return "0/0";
  return `${passed}/${total} (${Math.floor((passed / total) * 100)}%)`;
}

/**
 * The test selected after moving `delta` rows (−1 = up, +1 = down) from `selected` through the
 * flattened list of all parts' tests. Stops at either end; with nothing selected, picks the first.
 */
export function moveSelection(view: ResultsView, selected: string | undefined, delta: number): string | undefined {
  const ids = view.parts.flatMap((p) => p.rows.map((r) => r.testId));
  const index = selected === undefined ? -1 : ids.indexOf(selected);
  if (index === -1) return ids[0];
  return ids[Math.min(ids.length - 1, Math.max(0, index + delta))];
}

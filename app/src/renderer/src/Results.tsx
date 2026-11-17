import type { RunReport } from "../../shared/api";

export type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; report: RunReport }
  | { kind: "failed"; message: string };

const percent = (passed: number, total: number) => (total === 0 ? 0 : Math.round((passed / total) * 100));

/** A basic summary of the last run: passed/total and the pass rate, overall and per part. */
export function Results({ state }: { state: RunState }) {
  switch (state.kind) {
    case "idle":
      return <p className="placeholder">Press Run to execute the sample tests.</p>;
    case "running":
      return <p className="placeholder">Running sample tests…</p>;
    case "failed":
      return <p className="results error">{state.message}</p>;
  }
  const { summary } = state.report;
  const allPassed = summary.total > 0 && summary.passed === summary.total;
  return (
    <div className="results">
      <p className={`summary ${allPassed ? "pass" : "fail"}`}>
        Sample tests: {summary.passed}/{summary.total} passed ({percent(summary.passed, summary.total)}%)
      </p>
      <ul className="part-summaries">
        {summary.parts.map((p) => (
          <li key={p.partId}>
            {p.partId}: {p.passed}/{p.total}
          </li>
        ))}
      </ul>
    </div>
  );
}

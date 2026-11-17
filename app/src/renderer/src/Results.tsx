import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { GradedTest, QuestionView, RunMode } from "../../shared/api";
import { diffOutput, finalNewlineNote, type DiffLine, type Segment } from "./diff";
import { formatRate, moveSelection, resultsView, type RowStatus, type TestRow } from "./results-model";

export type RunState =
  | { kind: "idle" }
  /** A run in progress (`finished` false) or complete; `results` grow as tests finish. */
  | { kind: "active"; runId: number; mode: RunMode; results: GradedTest[]; finished: boolean }
  | { kind: "failed"; mode: RunMode; message: string };

const STATUS: Record<RowStatus, { icon: string; text: string }> = {
  pass: { icon: "✓", text: "Passed" },
  wrong: { icon: "✗", text: "Wrong answer" },
  timeout: { icon: "⏱", text: "Time limit exceeded" },
  error: { icon: "!", text: "Runtime error" },
  pending: { icon: "○", text: "Pending" },
};

const MODE_NAME: Record<RunMode, string> = { run: "Sample tests", submit: "All tests" };

/**
 * The last run: a summary bar with the overall and per-part pass rates, the tests grouped by
 * part, and the selected test's details. `hint` is shown before the first run.
 */
export function Results({ question, state, hint }: { question: QuestionView | undefined; state: RunState; hint: string }) {
  if (state.kind === "idle" || !question) return <p className="placeholder">{hint}</p>;
  if (state.kind === "failed") return <p className="results error">{state.message}</p>;
  // A new run starts with a fresh selection.
  return <RunResults key={state.runId} question={question} state={state} />;
}

function RunResults({ question, state }: { question: QuestionView; state: Extract<RunState, { kind: "active" }> }) {
  const view = resultsView(question, state.mode, state.results);
  const rows = view.parts.flatMap((p) => p.rows);
  const [chosen, setChosen] = useState<string>();
  // Until the user picks a test, follow the first failure (else the first finished test).
  const finished = rows.filter((r) => r.status !== "pending");
  const selectedId = chosen ?? (finished.find((r) => r.status !== "pass") ?? finished[0])?.testId;
  const selected = rows.find((r) => r.testId === selectedId);

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = moveSelection(view, selectedId, delta);
    setChosen(next);
    document.getElementById(rowDomId(next))?.scrollIntoView({ block: "nearest" });
  };

  const { rate } = view;
  const outcome = !state.finished ? "running" : rate.passed === rate.total && rate.total > 0 ? "pass" : "fail";
  return (
    <div className="run-results">
      <div className="summary-bar">
        <span className={`summary ${outcome}`}>
          {MODE_NAME[state.mode]}: {formatRate(rate)}
          {!state.finished && ` · running ${rate.finished}/${rate.total}…`}
        </span>
        {view.parts.map((p) => (
          <span key={p.partId} className="part-rate">
            {p.title}: {formatRate(p.rate)}
          </span>
        ))}
      </div>
      <Group orientation="horizontal" className="results-body">
        <Panel defaultSize="32" minSize="15">
          <div
            className="test-list"
            tabIndex={0}
            role="listbox"
            aria-label="Tests"
            aria-activedescendant={selectedId && rowDomId(selectedId)}
            onKeyDown={onKeyDown}
          >
            {view.parts.map((p) => (
              <div key={p.partId} role="group" aria-label={p.title}>
                <div className="part-heading">
                  {p.title} <span className="muted">{formatRate(p.rate)}</span>
                </div>
                {p.rows.map((r) => (
                  <div
                    key={r.testId}
                    id={rowDomId(r.testId)}
                    role="option"
                    aria-selected={r.testId === selectedId}
                    className={`test-row ${r.testId === selectedId ? "selected" : ""}`}
                    onClick={() => setChosen(r.testId)}
                  >
                    <StatusIcon status={r.status} />
                    <span>{r.label}</span>
                    {r.result && <span className="muted duration">{r.result.durationMs} ms</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>
        <Separator className="separator vertical" />
        <Panel minSize="20">
          {selected?.result ? (
            <TestDetail key={selected.testId} row={selected} result={selected.result} />
          ) : (
            <p className="placeholder">{selected ? "Waiting for this test to finish…" : "Select a test."}</p>
          )}
        </Panel>
      </Group>
    </div>
  );
}

const rowDomId = (testId: string | undefined) => `test-${testId?.replaceAll("/", "-")}`;

function StatusIcon({ status }: { status: RowStatus }) {
  const { icon, text } = STATUS[status];
  return (
    <span className={`status-icon ${status}`} title={text} aria-label={text}>
      {icon}
    </span>
  );
}

/** Everything about one finished test. A hidden test's input and expected output start collapsed. */
function TestDetail({ row, result }: { row: TestRow; result: GradedTest }) {
  // A hidden test's data starts collapsed. The diff shows the expected output, so it does too.
  const hiddenData = row.kind === "hidden" ? { collapsed: true, hint: "hidden test" } : {};
  return (
    <div className="test-detail">
      <div className="detail-header">
        <StatusIcon status={result.status} />
        <strong>
          {row.label}: {STATUS[result.status].text}
        </strong>
        <span className="muted">
          {result.durationMs} ms · exit code {result.exitCode ?? "none"}
        </span>
      </div>
      {result.note && <p className="note">{result.note}</p>}
      <Section title="Input" {...hiddenData}>
        <Output text={result.input} />
      </Section>
      <Section title="Expected output" {...hiddenData}>
        <Output text={result.expected} />
      </Section>
      <Section title="Your output">
        <Output text={result.stdout} />
      </Section>
      {result.status !== "pass" && (
        <Section title="Diff (expected → yours)" {...hiddenData}>
          <Diff expected={result.expected} actual={result.stdout} />
        </Section>
      )}
      {result.stderr && (
        <Section title="Stderr">
          <Output text={result.stderr} className="stderr" />
        </Section>
      )}
    </div>
  );
}

/** A collapsible titled block of the detail pane. */
export function Section({
  title,
  collapsed = false,
  hint,
  children,
}: {
  title: string;
  collapsed?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <details className="section" open={!collapsed}>
      <summary>
        {title}
        {hint && <span className="muted"> ({hint})</span>}
      </summary>
      {children}
    </details>
  );
}

/** Program text in a monospace block, or "(empty)". */
export function Output({ text, className = "" }: { text: string; className?: string }) {
  return text === "" ? <p className="muted empty">(empty)</p> : <pre className={`output ${className}`}>{text}</pre>;
}

const LINE_PREFIX: Record<DiffLine["kind"], string> = { same: " ", removed: "-", added: "+" };

function Diff({ expected, actual }: { expected: string; actual: string }) {
  const lines = diffOutput(expected, actual);
  const newlineNote = finalNewlineNote(expected, actual);
  const noteLine = newlineNote && <p className="note">{newlineNote}</p>;
  if (lines.every((l) => l.kind === "same")) {
    return noteLine ?? <p className="muted empty">No line differences.</p>;
  }
  return (
    <>
      {noteLine}
      <pre className="output diff">
      {lines.map((line, i) => (
        <div key={i} className={`diff-line ${line.kind}`}>
          <span className="diff-prefix">{LINE_PREFIX[line.kind]}</span>
          {line.kind !== "same" && line.segments ? line.segments.map((s, k) => <DiffSegment key={k} segment={s} />) : line.text}
        </div>
      ))}
      </pre>
    </>
  );
}

/** A changed run shows its whitespace, so a wrong space or tab is visible. */
function DiffSegment({ segment }: { segment: Segment }) {
  if (!segment.changed) return <>{segment.text}</>;
  return <mark className="diff-change">{segment.text.replaceAll(" ", "·").replaceAll("\t", "→")}</mark>;
}

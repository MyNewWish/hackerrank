import { Group, Panel, Separator } from "react-resizable-panels";
import type { CustomRunResult } from "../../shared/api";
import { Output, Section } from "./Results";

/** The stdin box's DOM id; the app's run shortcuts start a custom run while it has focus. */
export const CUSTOM_STDIN_ID = "custom-stdin";

export type CustomState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: CustomRunResult }
  | { kind: "failed"; message: string };

/** How the program ended. Nothing is graded, so there is no pass or fail. */
const OUTCOME: Record<CustomRunResult["status"], { text: string; className: string }> = {
  ok: { text: "Finished", className: "neutral" },
  error: { text: "Runtime error", className: "fail" },
  timeout: { text: "Time limit exceeded", className: "fail" },
};

/**
 * The Custom input tab: the candidate's own stdin on the left, what their code did with it on
 * the right. `disabled` while any run is in progress, so runs never overlap.
 */
export function CustomRun({
  input,
  onInputChange,
  state,
  onRun,
  disabled,
  shortcut,
  codeName,
}: {
  input: string;
  onInputChange: (input: string) => void;
  state: CustomState;
  onRun: () => void;
  disabled: boolean;
  /** The key combination that runs this input from the stdin box, for the button's tooltip. */
  shortcut: string;
  /** Whose code runs: "My solution" or "Reference". Results are cleared when it changes. */
  codeName: string;
}) {
  return (
    <Group orientation="horizontal" className="results-body">
      <Panel defaultSize="40" minSize="15">
        <div className="custom-input">
          <div className="custom-toolbar">
            <label htmlFor={CUSTOM_STDIN_ID}>Stdin</label>
            <button type="button" className="secondary" onClick={onRun} disabled={disabled} title={`Run ${codeName.toLowerCase()} on this input (${shortcut})`}>
              Run with this input
            </button>
          </div>
          <textarea
            id={CUSTOM_STDIN_ID}
            className="custom-stdin"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            spellCheck={false}
            placeholder="Type the input your program reads from stdin…"
          />
        </div>
      </Panel>
      <Separator className="separator vertical" />
      <Panel minSize="20">
        <CustomOutput state={state} codeName={codeName} />
      </Panel>
    </Group>
  );
}

function CustomOutput({ state, codeName }: { state: CustomState; codeName: string }) {
  switch (state.kind) {
    case "idle":
      return <p className="placeholder">Runs the code on screen ({codeName}) on this input. Nothing is graded.</p>;
    case "running":
      return <p className="placeholder">Running…</p>;
    case "failed":
      return (
        <p className="results error">
          {codeName}: {state.message}
        </p>
      );
  }
  const { result } = state;
  const outcome = OUTCOME[result.status];
  // The runner's note (time or output limit) says more than the generic outcome.
  const headline = result.note ?? outcome.text;
  return (
    <div className="test-detail">
      <div className="detail-header">
        <strong className={`summary ${outcome.className}`}>
          {codeName} · {headline}
        </strong>
        <span className="muted">
          {result.durationMs} ms · exit code {result.exitCode ?? "none"}
        </span>
      </div>
      <Section title="Stdout">
        <Output text={result.stdout} />
      </Section>
      <Section title="Stderr">
        <Output text={result.stderr} className="stderr" />
      </Section>
    </div>
  );
}

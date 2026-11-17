import { useEffect, useState, type ReactNode } from "react";
import type { QuestionSummary } from "../../shared/api";
import { errorMessage } from "./errors";

const api = window.hackrank;

/** A well-formed question, the only kind test mode opens. */
export type OkSummary = Extract<QuestionSummary, { ok: true }>;

/**
 * The screen the app opens on: every question in bank order, the selected one's details and
 * Start testing. The problem statement is never shown here, so the user cannot read a question
 * before its timer starts. Selection is the app's, so it is kept across test mode.
 */
export function Home(props: {
  questions: QuestionSummary[];
  /** Why the bank could not be listed. */
  bankError: string | undefined;
  /** The bank has been listed and has no questions. */
  bankEmpty: boolean;
  /** The selected question; none, or one no longer listed, shows no details. */
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** Opens test mode for the selected question. */
  onStart: (summary: OkSummary) => void;
  /** A question is being opened; Start testing waits for it. */
  starting: boolean;
  /** Settings is reachable from Home only. */
  settingsButton: ReactNode;
}) {
  const { questions, selectedId } = props;
  const selected = questions.find((q) => q.id === selectedId);

  return (
    <>
      <header className="top-bar">
        <span className="app-title">Questions</span>
        <span className="spacer" />
        {props.settingsButton}
      </header>
      <div className="home">
        <BankMessage bankError={props.bankError} empty={props.bankEmpty} />
        {questions.length > 0 && (
          <div className="home-body">
            <ul className="question-list" aria-label="Questions">
              {questions.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    className={`question-row${q.id === selectedId ? " selected" : ""}`}
                    aria-pressed={q.id === selectedId}
                    onClick={() => props.onSelect(q.id)}
                  >
                    <span className="question-id">{q.id}</span>
                    {q.ok ? (
                      <>
                        <span className="question-title">{q.title}</span>
                        <span className={`difficulty ${q.difficulty}`}>{q.difficulty}</span>
                        <span className="muted">{q.targetMinutes} min</span>
                      </>
                    ) : (
                      <span className="question-title malformed-name">⚠ {q.folder} is malformed</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <section className="question-details" aria-label="Selected question">
              {selected ? (
                <Details key={selected.id} summary={selected} onStart={props.onStart} starting={props.starting} />
              ) : (
                <p className="placeholder">Select a question to see its details.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

/** Why the list is empty, if it is. */
function BankMessage({ bankError, empty }: { bankError: string | undefined; empty: boolean }) {
  if (bankError) {
    return (
      <div className="malformed">
        <h2>Cannot read the question bank</h2>
        <p>
          {bankError}. Choose another folder in Settings, or fix this one; the bank is read again when you return
          to Home.
        </p>
      </div>
    );
  }
  if (empty) {
    return (
      <p className="placeholder">
        No questions in this bank. Add a q&lt;N&gt;_&lt;slug&gt; folder; it appears when you return to Home, or
        choose another folder in Settings.
      </p>
    );
  }
  return null;
}

/**
 * The selected question's title, difficulty, target time and number of parts, with Start
 * testing; for a malformed one, its validation errors instead.
 */
function Details(props: {
  summary: QuestionSummary;
  onStart: (summary: OkSummary) => void;
  starting: boolean;
}) {
  const { summary } = props;
  const parts = usePartCount(summary.ok ? summary.id : undefined);
  if (!summary.ok) {
    return (
      <div className="malformed">
        <h2>{summary.folder} is malformed</h2>
        <p>Fix these problems in the question folder; the fix appears when you return to Home:</p>
        <ul>
          {summary.errors.map((e, i) => (
            <li key={i}>
              <code>{e.path}</code>: {e.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="details">
      <h2>
        {summary.id}. {summary.title}
      </h2>
      <dl>
        <dt>Difficulty</dt>
        <dd className={`difficulty ${summary.difficulty}`}>{summary.difficulty}</dd>
        <dt>Target time</dt>
        <dd>{summary.targetMinutes} min</dd>
        <dt>Parts</dt>
        <dd>
          <PartsValue parts={parts} />
        </dd>
      </dl>
      <button
        type="button"
        className="primary"
        onClick={() => props.onStart(summary)}
        disabled={props.starting}
        title="Open the question and start the stopwatch"
      >
        Start testing
      </button>
    </div>
  );
}

function PartsValue({ parts }: { parts: PartCount }) {
  if (parts.kind === "loaded") return <>{parts.count}</>;
  if (parts.kind === "failed") return <span className="error">{parts.error}</span>;
  return <>…</>;
}

/** A question's number of parts, while it is read or why it could not be. */
type PartCount = { kind: "loading" } | { kind: "loaded"; count: number } | { kind: "failed"; error: string };

/**
 * How many parts question `id` has, read from the bank (its statement is not shown). It starts
 * as loading once per mount, so callers key it by question.
 */
function usePartCount(id: string | undefined): PartCount {
  const [parts, setParts] = useState<PartCount>({ kind: "loading" });
  useEffect(() => {
    if (id === undefined) return;
    let live = true;
    api.loadQuestion(id).then(
      (q) => live && setParts({ kind: "loaded", count: q.parts.length }),
      (e) => live && setParts({ kind: "failed", error: errorMessage(e) }),
    );
    return () => {
      live = false;
    };
  }, [id]);
  return parts;
}

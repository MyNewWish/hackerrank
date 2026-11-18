import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Difficulty, QuestionSummary, QuestionView } from "../../shared/api";
import { errorMessage } from "./errors";
import {
  homeKeyAction,
  isFiltering,
  NO_FILTER,
  questionList,
  type OkSummary,
  type QuestionFilter,
} from "./question-list-model";
import { StatementMarkdown } from "./Statement";
import { statementPreview } from "./statement-preview";

const api = window.hackerrank;


/**
 * The screen the app opens on: the bank's questions in bank order, narrowed by a search box, tag
 * chips and a difficulty filter, with the selected one's details and Start testing. Below Start
 * testing is only a preview of the problem statement (its intro and part titles), never the full
 * statement, so the user can get a question's gist without reading enough to start solving before
 * its timer starts.
 * Filter and selection are the app's, so they are kept across test mode. The search box takes
 * focus when Home opens; up/down move the selection from it or from a row, and Enter or a
 * double-click starts testing a well-formed question.
 */
export function Home(props: {
  questions: QuestionSummary[];
  /** Why the bank could not be listed. */
  bankError: string | undefined;
  /** The bank has been listed and has no questions. */
  bankEmpty: boolean;
  /** What the list is narrowed to; the app keeps it across test mode. */
  filter: QuestionFilter;
  /** Sets the filter; the app clears the selection if the new filter hides it. */
  onFilterChange: (filter: QuestionFilter) => void;
  /** The selected question; none, or one not visible, shows no details. */
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** Opens test mode for the selected question. */
  onStart: (summary: OkSummary) => void;
  /** A question is being opened; Start testing waits for it. */
  starting: boolean;
  /** Settings is reachable from Home only. */
  settingsButton: ReactNode;
}) {
  const { questions, filter, onFilterChange } = props;
  const view = questionList(questions, filter, props.selectedId);
  const { selectedId } = view;
  const selected = view.visible.find((q) => q.id === selectedId);
  // A selected tag gone from the bank after a rescan keeps its chip, so it can still be turned off.
  const chips = [...new Set([...view.tags, ...filter.tags])].sort();
  const clear = () => onFilterChange(NO_FILTER);

  const toggleTag = (tag: string) => {
    const tags = filter.tags.includes(tag) ? filter.tags.filter((t) => t !== tag) : [...filter.tags, tag];
    onFilterChange({ ...filter, tags });
  };

  /**
   * Up/down and Enter in the search box or on a row. Focus follows the selection between rows but
   * stays in the search box, so typing can go on. A focused row is the selected one, so Enter on a
   * row starts that row.
   */
  const onHomeKeyDown = (e: KeyboardEvent<HTMLElement>, from: "search" | "row") => {
    const onRow = from === "row";
    const action = homeKeyAction(view, e.key);
    // Enter on a malformed row is still swallowed, so it does not click (select) it again.
    if (action === undefined) {
      if (onRow && e.key === "Enter") e.preventDefault();
      return;
    }
    e.preventDefault();
    if (action.kind === "start") {
      props.onStart(action.summary);
      return;
    }
    props.onSelect(action.id);
    if (onRow) document.getElementById(rowDomId(action.id))?.focus();
  };

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
          <>
            <div className="filters" role="search">
              <div className="filter-row">
                <input
                  type="search"
                  className="search"
                  placeholder="Search by id, title or tag"
                  aria-label="Search questions"
                  autoFocus
                  onKeyDown={(e) => onHomeKeyDown(e, "search")}
                  value={filter.query}
                  onChange={(e) => onFilterChange({ ...filter, query: e.target.value })}
                />
                <div className="ide-mode" role="group" aria-label="Difficulty">
                  {DIFFICULTY_OPTIONS.map(({ value, label }) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={filter.difficulty === value}
                      onClick={() => onFilterChange({ ...filter, difficulty: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="muted count" aria-live="polite">
                  {view.visible.length} of {view.total} {view.total === 1 ? "question" : "questions"}
                </span>
                <button type="button" className="link" onClick={clear} disabled={!isFiltering(filter)}>
                  Clear filters
                </button>
              </div>
              {chips.length > 0 && (
                <div className="tag-chips" role="group" aria-label="Tags">
                  {chips.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="chip"
                      aria-pressed={filter.tags.includes(tag)}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="home-body">
              {view.visible.length > 0 ? (
                <ul className="question-list" aria-label="Questions" onKeyDown={(e) => onHomeKeyDown(e, "row")}>
                  {view.visible.map((q) => (
                    <li key={q.id}>
                      <button
                        type="button"
                        id={rowDomId(q.id)}
                        className={`question-row${q.id === selectedId ? " selected" : ""}`}
                        aria-pressed={q.id === selectedId}
                        onClick={() => props.onSelect(q.id)}
                        onFocus={() => props.onSelect(q.id)}
                        onDoubleClick={() => q.ok && props.onStart(q)}
                      >
                        <span className="question-id">{q.id}</span>
                        {q.ok ? (
                          <>
                            <span className="question-title">{q.title}</span>
                            <span className={`difficulty ${q.difficulty}`}>{q.difficulty}</span>
                            <span className="muted">{q.targetMinutes} min</span>
                            <Tags tags={q.tags} />
                          </>
                        ) : (
                          <span className="question-title malformed-name">⚠ {q.folder} is malformed</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="question-list">
                  <p className="placeholder">
                    No questions match. Try a shorter search, fewer tags or another difficulty, or{" "}
                    <button type="button" className="link" onClick={clear}>
                      clear all filters
                    </button>
                    .
                  </p>
                </div>
              )}
              <section className="question-details" aria-label="Selected question">
                {selected ? (
                  <Details key={selected.id} summary={selected} onStart={props.onStart} starting={props.starting} />
                ) : (
                  <p className="placeholder">Select a question to see its details.</p>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** The difficulty filter's buttons; Any shows every difficulty. */
const DIFFICULTY_OPTIONS: { value: Difficulty | undefined; label: string }[] = [
  { value: undefined, label: "Any" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

/** The DOM id of question `id`'s row, so arrow keys can focus it. */
function rowDomId(id: string): string {
  return `question-row-${id}`;
}

/** A question's tags, as small labels. */
function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="tags">
      {tags.map((t) => (
        <span key={t} className="tag">
          {t}
        </span>
      ))}
    </span>
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
 * The selected question's title, difficulty, target time, tags and number of parts, with Start
 * testing and then a preview of its statement; for a malformed one, its validation errors instead.
 */
function Details(props: {
  summary: QuestionSummary;
  onStart: (summary: OkSummary) => void;
  starting: boolean;
}) {
  const { summary } = props;
  const question = useQuestion(summary.ok ? summary.id : undefined);
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
        <dt>Tags</dt>
        <dd>{summary.tags.length > 0 ? <Tags tags={summary.tags} /> : <span className="muted">none</span>}</dd>
        <dt>Parts</dt>
        <dd>
          <WhenLoaded question={question}>{(q) => q.parts.length}</WhenLoaded>
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
      <section className="statement-preview" aria-label="Statement preview">
        <WhenLoaded question={question}>{(q) => <Preview statement={q.statement} />}</WhenLoaded>
      </section>
    </div>
  );
}

/** The statement's intro and part titles, ending with a note that the rest waits for testing. */
function Preview({ statement }: { statement: string }) {
  const { intro, partTitles } = useMemo(() => statementPreview(statement), [statement]);
  return (
    <>
      <div className="statement">
        <StatementMarkdown markdown={intro} />
      </div>
      {partTitles.length > 0 && (
        <ul className="part-titles" aria-label="Parts">
          {partTitles.map((title, i) => (
            <li key={i}>{title}</li>
          ))}
        </ul>
      )}
      <p className="muted">Full statement opens when you start testing.</p>
    </>
  );
}

/** What `children` makes of the loaded question; an ellipsis while it loads, or why it could not. */
function WhenLoaded(props: { question: LoadedQuestion; children: (q: QuestionView) => ReactNode }) {
  const { question } = props;
  if (question.kind === "loaded") return <>{props.children(question.question)}</>;
  if (question.kind === "failed") return <span className="error">{question.error}</span>;
  return <span className="muted">…</span>;
}

/** A question read from the bank, while it is read or why it could not be. */
type LoadedQuestion =
  | { kind: "loading" }
  | { kind: "loaded"; question: QuestionView }
  | { kind: "failed"; error: string };

/**
 * Question `id` read from the bank, for its part count and statement preview. It is read once per
 * mount, so callers key it by question; that way a new selection never shows the last one's.
 */
function useQuestion(id: string | undefined): LoadedQuestion {
  const [question, setQuestion] = useState<LoadedQuestion>({ kind: "loading" });
  useEffect(() => {
    if (id === undefined) return;
    let live = true;
    api.loadQuestion(id).then(
      (q) => live && setQuestion({ kind: "loaded", question: q }),
      (e) => live && setQuestion({ kind: "failed", error: errorMessage(e) }),
    );
    return () => {
      live = false;
    };
  }, [id]);
  return question;
}

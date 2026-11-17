import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { CodeView, DiscoverResult, QuestionSummary, QuestionView, RunMode } from "../../shared/api";
import { CUSTOM_STDIN_ID, CustomRun, type CustomState } from "./CustomRun";
import { errorMessage } from "./errors";
import { trackEditor } from "./monaco";
import { Results, VIEW_NAME, type RunState } from "./Results";
import { shortcutAction } from "./shortcuts";
import { Statement } from "./Statement";
import { Stopwatch } from "./Stopwatch";
import { useDarkMode } from "./useDarkMode";

const api = window.hackrank;
const AUTOSAVE_DELAY_MS = 500;
const IS_MAC = navigator.userAgent.includes("Macintosh");
const MOD = IS_MAC ? "⌘" : "Ctrl";

const VIEW_OPTIONS: { view: CodeView; title: string }[] = [
  { view: "solution", title: "Show your own code" },
  { view: "reference", title: "Show the question's reference solution (your own copy, which you may edit)" },
];

/**
 * The open question, which code the editor shows (`view`) and that code, loaded together so they
 * never mismatch. `codeError` instead of `initialCode` when the code could not be read.
 */
interface OpenQuestion {
  question: QuestionView;
  view: CodeView;
  initialCode: string;
  codeError?: string;
}

/** The editor's pyright document: each view is its own, so diagnostics never mix. */
function documentId({ question, view }: OpenQuestion): string {
  return view === "solution" ? question.id : `${question.id}:reference`;
}

export type ResultsTab = "tests" | "custom";

/** What the app can ask of the screen on screen. */
export interface TestScreenHandle {
  /** Saves any pending code now, e.g. before another question or bank replaces this screen. */
  flush(): Promise<void>;
  /** Whether question `id` is open (loaded, not malformed or failed). */
  isOpen(id: string): boolean;
}

/**
 * Runs, view switches and Recover share one lock (and the toolbar's `running` state), so a run
 * never grades code other than what is on screen. It is the app's, not a screen's: a run goes on
 * after the user leaves its question, and one run at a time.
 */
export interface RunLock {
  /** A run is in progress, possibly for a question the user has since left. */
  running: boolean;
  /** Set synchronously, so a shortcut pressed twice in a row cannot start two runs. */
  busy(): boolean;
  /** Runs `job` unless the lock is taken. */
  withLock(job: () => Promise<void>): Promise<void>;
}

export function useRunLock(): RunLock {
  const [running, setRunning] = useState(false);
  const busy = useRef(false);
  return {
    running,
    busy: () => busy.current,
    withLock: async (job) => {
      if (busy.current) return;
      busy.current = true;
      setRunning(true);
      try {
        await job();
      } finally {
        busy.current = false;
        setRunning(false);
      }
    },
  };
}

/**
 * The editor screen for one question: statement, editor, results, custom input, the My solution |
 * Reference switch, Reset/Recover and the stopwatch. Mount it afresh (with a new `key`) to open
 * another question; it loads `summary` on mount. State kept while the app is open (stopwatch
 * starts, custom stdin, revealed references, the results tab and the autosave error) is the app's.
 */
export function TestScreen(props: {
  /** The question to open; malformed (or none) shows why nothing is open instead. */
  summary: QuestionSummary | undefined;
  /** Why the bank could not be listed. */
  bankError: string | undefined;
  /** The bank has been listed and has no questions. */
  bankEmpty: boolean;
  python: DiscoverResult | undefined;
  lock: RunLock;
  /** When this question's stopwatch started (its first keystroke). */
  startedAt: number | undefined;
  onStartStopwatch: () => void;
  customInput: string;
  onCustomInputChange: (input: string) => void;
  /** Questions whose reference the user has confirmed revealing; the screen adds to it. */
  revealed: Set<string>;
  tab: ResultsTab;
  onTabChange: (tab: ResultsTab) => void;
  saveError: string | undefined;
  /** Each save's outcome: an error message, or undefined once a save succeeds. */
  onSaved: (error: string | undefined) => void;
  /** The toolbar's leading controls, its Settings button and its editor mode switch. */
  toolbarStart: ReactNode;
  settingsButton: ReactNode;
  ideModeSwitch: ReactNode;
  ref?: Ref<TestScreenHandle>;
}) {
  const { summary, python, lock, revealed, onSaved } = props;
  const { running } = lock;
  const dark = useDarkMode();
  const [open, setOpen] = useState<OpenQuestion>();
  const [loadError, setLoadError] = useState<string>();
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [custom, setCustom] = useState<CustomState>({ kind: "idle" });
  const code = useRef("");
  /** False once the screen is gone; its late replies are dropped. */
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  /** The view the user most recently picked; replies for the other view arrived too late and are dropped. */
  const currentView = useRef<CodeView>("solution");
  /** Whether the open reference copy differs from the bank's `reference.py`; enables Recover. */
  const [referenceModified, setReferenceModified] = useState(false);
  /** Numbers reference checks, so a slow earlier answer cannot overwrite a later one. */
  const referenceSeq = useRef(0);
  /** Re-reads whether question `id`'s reference copy is modified, if the reference is still on screen. */
  const checkReference = useCallback(async (id: string) => {
    const seq = ++referenceSeq.current;
    try {
      const { modified } = await api.referenceStatus(id);
      const latest = referenceSeq.current === seq;
      if (latest && live.current && currentView.current === "reference") setReferenceModified(modified);
    } catch (e) {
      console.error("could not check the reference copy:", e);
    }
  }, []);
  const autosave = useAutosave(onSaved, (saved) => {
    if (saved.view === "reference") void checkReference(saved.id);
  });
  const editorRef = useRef<editor.IStandaloneCodeEditor>(undefined);

  useImperativeHandle(
    props.ref,
    () => ({ flush: autosave.flush, isOpen: (id) => open?.question.id === id }),
    [autosave, open],
  );

  // Code still pending when the screen goes is saved; the app normally flushes it first.
  useEffect(() => () => void autosave.flush(), [autosave]);

  // Opens the question, or for a malformed one shows its validation errors instead. Every
  // question opens on my solution, never on its answer.
  const id = summary?.ok ? summary.id : undefined;
  useEffect(() => {
    if (id === undefined) return;
    void (async () => {
      try {
        const [question, initialCode] = await Promise.all([api.loadQuestion(id), api.readCode(id, "solution")]);
        if (!live.current) return;
        code.current = initialCode;
        setOpen({ question, view: "solution", initialCode });
        setLoadError(undefined);
      } catch (e) {
        if (!live.current) return;
        setOpen(undefined);
        setLoadError(errorMessage(e));
      }
    })();
  }, [id]);

  /**
   * Runs `job` for the open question unless a run is already in progress: Run, Submit and a
   * custom run share one lock, so they never overlap. Each of them saves the code itself.
   */
  const withRunLock = (job: (question: QuestionView, view: CodeView) => Promise<void>) => {
    if (!open || open.codeError !== undefined || !python?.ok) return;
    const { question, view } = open;
    return lock.withLock(() => {
      autosave.cancel();
      return job(question, view);
    });
  };

  /** Numbers the screen's runs, so late results of an earlier run are ignored. */
  const runSeq = useRef(0);

  /**
   * Saves, then runs the sample tests (`run`) or every test (`submit`) on the code on screen (my
   * solution or the reference copy), showing results as they finish.
   */
  const startRun = (mode: RunMode) =>
    withRunLock(async ({ id }, view) => {
      props.onTabChange("tests");
      const runId = ++runSeq.current;
      setRun({ kind: "active", runId, view, mode, results: [], finished: false });
      /** Updates the run state only while it still shows this run (the user may have switched view). */
      const updateThisRun = (next: (s: Extract<RunState, { kind: "active" }>) => RunState) =>
        setRun((s) => (s.kind === "active" && s.runId === runId ? next(s) : s));
      try {
        const report = await api.run(id, view, code.current, mode, (result) =>
          updateThisRun((s) => ({ ...s, results: [...s.results, result] })),
        );
        updateThisRun((s) => ({ ...s, results: report.results, finished: true }));
      } catch (e) {
        updateThisRun(() => ({ kind: "failed", view, mode, message: errorMessage(e) }));
      }
      // The run saved the code.
      if (view === "reference") void checkReference(id);
    });

  /** Saves, then runs the code on screen once on the Custom tab's stdin, with no grading. */
  const startCustomRun = () =>
    withRunLock(async ({ id }, view) => {
      setCustom({ kind: "running" });
      const stillShown = () => live.current && currentView.current === view;
      try {
        const result = await api.runCustom(id, view, code.current, props.customInput);
        if (stillShown()) setCustom({ kind: "done", result });
      } catch (e) {
        if (stillShown()) setCustom({ kind: "failed", message: errorMessage(e) });
      }
      if (view === "reference") void checkReference(id);
    });

  /** After confirmation, empties the editor and the saved file. The stopwatch keeps running. */
  const resetCode = async () => {
    if (!open || open.view !== "solution") return;
    const { id } = open.question;
    // The other view is loading, or a run is grading the saved file: leave the code alone.
    if (!live.current || currentView.current !== "solution" || lock.busy()) return;
    if (!window.confirm(`Reset ${id}? This empties the editor and your saved code for this question.`)) return;
    // The change event queues the empty file's save; flush writes it now.
    editorRef.current?.setValue("");
    await autosave.flush();
  };

  /** After confirmation, replaces the reference copy (and the editor) with the bank's current `reference.py`. */
  const recoverReference = async () => {
    if (!open || open.view !== "reference" || open.codeError !== undefined) return;
    const { id } = open.question;
    if (!live.current || currentView.current !== "reference" || lock.busy()) return;
    const ask = `Recover the reference for ${id}? This replaces your edited reference copy with the question bank's reference.py.`;
    if (!window.confirm(ask)) return;
    await lock.withLock(async () => {
      autosave.cancel(); // a pending save of the edits being thrown away
      try {
        const recovered = await api.recoverReference(id);
        if (!live.current || currentView.current !== "reference") return;
        // A flush, so the stopwatch ignores it; the save it queues writes the same text.
        editorRef.current?.setValue(recovered);
        await autosave.flush();
      } catch (e) {
        onSaved(errorMessage(e));
      }
      void checkReference(id);
    });
  };

  /**
   * Shows my solution or the reference copy in the editor. The first reveal of a question's
   * reference asks first, since peeking spoils the practice. Results belong to the code on screen,
   * so both result tabs are cleared.
   */
  const switchView = async (view: CodeView) => {
    if (!open || lock.busy() || view === currentView.current) return;
    const { question } = open;
    const { id } = question;
    if (!live.current) return;
    if (view === "reference" && !revealed.has(id)) {
      const ask = `Show the reference solution for ${id}? Looking before your timed attempt spoils the question.`;
      if (!window.confirm(ask)) return;
      revealed.add(id);
    }
    await lock.withLock(async () => {
      currentView.current = view;
      await autosave.flush();
      setRun({ kind: "idle" });
      setCustom({ kind: "idle" });
      referenceSeq.current++; // drop answers about the view being left
      setReferenceModified(false);
      const stillWanted = () => live.current && currentView.current === view;
      try {
        const initialCode = await api.readCode(id, view);
        if (!stillWanted()) return;
        code.current = initialCode;
        setOpen({ question, view, initialCode });
        if (view === "reference") void checkReference(id);
      } catch (e) {
        if (!stillWanted()) return;
        code.current = "";
        setOpen({ question, view, initialCode: "", codeError: errorMessage(e) });
      }
    });
  };

  // Capture phase, so the editor never sees the shortcut (Monaco binds Ctrl+Enter itself).
  const startRunRef = useRef(startRun);
  startRunRef.current = startRun;
  const startCustomRunRef = useRef(startCustomRun);
  startCustomRunRef.current = startCustomRun;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mode = shortcutAction(e, IS_MAC);
      if (!mode) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      // Typing custom stdin, either shortcut runs the code on it rather than grading it.
      if (e.target instanceof HTMLElement && e.target.id === CUSTOM_STDIN_ID) void startCustomRunRef.current();
      else void startRunRef.current(mode);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const malformed = summary && !summary.ok ? summary : undefined;
  const { tab, onTabChange } = props;

  return (
    <>
      <header className="top-bar">
        {props.toolbarStart}
        {open && <Stopwatch startedAt={props.startedAt} targetMinutes={open.question.targetMinutes} />}
        {props.saveError && <span className="save-error">Autosave failed: {props.saveError}</span>}
        <span className="spacer" />
        {props.settingsButton}
        {open?.view === "reference" ? (
          <button
            type="button"
            className="secondary"
            onClick={() => void recoverReference()}
            disabled={running || !referenceModified}
            title={
              referenceModified
                ? "Replace your edited reference copy with the question bank's reference.py"
                : "The reference copy matches the question bank's reference.py"
            }
          >
            Recover
          </button>
        ) : (
          <button
            type="button"
            className="secondary"
            onClick={() => void resetCode()}
            disabled={!open || running}
            title="Empty the editor and the saved code for this question"
          >
            Reset
          </button>
        )}
        <div className="ide-mode" role="group" aria-label="Code shown">
          {VIEW_OPTIONS.map(({ view, title }) => (
            <button
              key={view}
              type="button"
              aria-pressed={open?.view === view}
              onClick={() => void switchView(view)}
              disabled={!open || running}
              title={title}
            >
              {VIEW_NAME[view]}
            </button>
          ))}
        </div>
        {props.ideModeSwitch}
        <button
          type="button"
          className="secondary"
          onClick={() => void startRun("run")}
          disabled={!open || running || !python?.ok}
          title={`Run the sample tests (${MOD}+')`}
        >
          Run
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void startRun("submit")}
          disabled={!open || running || !python?.ok}
          title={`Run all tests, including hidden ones (${MOD}+Enter)`}
        >
          Submit
        </button>
      </header>
      <Group orientation="horizontal" className="panels">
        <Panel defaultSize="45" minSize="15">
          {open ? (
            <Statement key={open.question.id} markdown={open.question.statement} />
          ) : (
            <NothingOpen bankError={props.bankError} malformed={malformed} loadError={loadError} empty={props.bankEmpty} />
          )}
        </Panel>
        <Separator className="separator vertical" />
        <Panel minSize="20">
          <Group orientation="vertical">
            <Panel defaultSize="65" minSize="10">
              {open?.codeError !== undefined ? (
                <p className="placeholder error" role="alert">
                  Cannot show the reference: {open.codeError}.
                </p>
              ) : open && (
                <Editor
                  key={documentId(open)}
                  language="python"
                  defaultValue={open.initialCode}
                  theme={dark ? "vs-dark" : "light"}
                  options={{
                    fontSize: 14,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    tabSize: 4,
                    // wordBasedSuggestions follows the editor mode; see applyIdeMode.
                  }}
                  onMount={(instance) => {
                    editorRef.current = instance;
                    trackEditor(instance, documentId(open));
                  }}
                  onChange={(value, event) => {
                    const { question, view } = open;
                    code.current = value ?? "";
                    autosave.schedule(question.id, view, code.current);
                    // Only typing in my solution starts the stopwatch: a flush is a programmatic
                    // replace (Reset, Recover), and the reference is not my attempt.
                    if (!event.isFlush && view === "solution") props.onStartStopwatch();
                  }}
                />
              )}
            </Panel>
            <Separator className="separator horizontal" />
            <Panel minSize="10">
              <div className="results-panel">
                <div className="results-tabs" role="tablist" aria-label="Results">
                  <button type="button" role="tab" aria-selected={tab === "tests"} onClick={() => onTabChange("tests")}>
                    Test results
                  </button>
                  <button type="button" role="tab" aria-selected={tab === "custom"} onClick={() => onTabChange("custom")}>
                    Custom input
                  </button>
                </div>
                <div className="results-tab-body" role="tabpanel">
                  {tab === "tests" ? (
                    <Results
                      question={open?.question}
                      state={run}
                      hint={`Run (${MOD}+') checks the sample tests; Submit (${MOD}+Enter) runs every test, including hidden ones.`}
                    />
                  ) : open ? (
                    <CustomRun
                      input={props.customInput}
                      onInputChange={props.onCustomInputChange}
                      state={custom}
                      onRun={() => void startCustomRun()}
                      disabled={running || !python?.ok}
                      shortcut={`${MOD}+Enter`}
                      codeName={VIEW_NAME[open.view]}
                    />
                  ) : (
                    <p className="placeholder">Open a question to run code on custom input.</p>
                  )}
                </div>
              </div>
            </Panel>
          </Group>
        </Panel>
      </Group>
    </>
  );
}

/** The statement panel when no question is open: why not, most specific reason first. */
function NothingOpen(props: {
  bankError: string | undefined;
  malformed: Extract<QuestionSummary, { ok: false }> | undefined;
  loadError: string | undefined;
  empty: boolean;
}) {
  if (props.bankError) {
    return (
      <div className="malformed">
        <h2>Cannot read the question bank</h2>
        <p>{props.bankError}. Choose another folder in Settings.</p>
      </div>
    );
  }
  if (props.malformed) {
    const { folder, errors } = props.malformed;
    return (
      <div className="malformed">
        <h2>{folder} is malformed</h2>
        <p>Fix these problems in the question folder, then click Refresh:</p>
        <ul>
          {errors.map((e, i) => (
            <li key={i}>
              <code>{e.path}</code>: {e.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (props.loadError) return <p className="placeholder">{props.loadError}</p>;
  if (props.empty) return <p className="placeholder">No questions in this bank. Add a q&lt;N&gt;_&lt;slug&gt; folder, then click Refresh.</p>;
  return <p className="placeholder">Loading…</p>;
}

/** Where an autosave writes: one view of one question. */
interface SaveTarget {
  id: string;
  view: CodeView;
}

/**
 * Saves the editor's code a moment after the last keystroke; `flush` saves any pending code now.
 * Each save carries the view it was typed in, so a switch never saves code into the other view.
 * Reports each save's outcome through `onSaved` (an error message, or undefined once a save
 * succeeds), and each successful async save through `onWritten`.
 */
function useAutosave(onSaved: (error: string | undefined) => void, onWritten: (saved: SaveTarget) => void) {
  const pending = useRef<SaveTarget & { code: string; timer: ReturnType<typeof setTimeout> }>(undefined);
  const saved = useRef(onSaved);
  saved.current = onSaved;
  const written = useRef(onWritten);
  written.current = onWritten;
  const [autosave] = useState(() => {
    /** Drops the pending save, returning it. */
    const cancel = () => {
      const save = pending.current;
      clearTimeout(save?.timer);
      pending.current = undefined;
      return save;
    };
    const flush = async () => {
      const save = cancel();
      if (!save) return;
      try {
        await api.writeCode(save.id, save.view, save.code);
        saved.current(undefined);
      } catch (e) {
        saved.current(errorMessage(e));
        return;
      }
      written.current({ id: save.id, view: save.view });
    };
    const schedule = (id: string, view: CodeView, code: string) => {
      clearTimeout(pending.current?.timer);
      pending.current = { id, view, code, timer: setTimeout(() => void flush(), AUTOSAVE_DELAY_MS) };
    };
    /** Saves synchronously: an async save started while the window closes may never land. */
    const flushNow = () => {
      const save = cancel();
      if (save) api.writeCodeSync(save.id, save.view, save.code);
    };
    return { schedule, flush, cancel, flushNow };
  });
  useEffect(() => {
    const onUnload = () => autosave.flushNow();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [autosave]);
  return autosave;
}

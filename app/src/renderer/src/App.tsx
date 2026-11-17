import Editor from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { DiscoverResult, QuestionSummary, QuestionView, RunMode } from "../../shared/api";
import { Results, type RunState } from "./Results";
import { shortcutAction } from "./shortcuts";
import { Statement } from "./Statement";
import { useDarkMode } from "./useDarkMode";

const api = window.hackrank;
const AUTOSAVE_DELAY_MS = 500;
const IS_MAC = navigator.userAgent.includes("Macintosh");
const MOD = IS_MAC ? "⌘" : "Ctrl";

/** The open question with the code that belongs to it, loaded together so they never mismatch. */
interface OpenQuestion {
  question: QuestionView;
  initialCode: string;
}

export function App() {
  const dark = useDarkMode();
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [open, setOpen] = useState<OpenQuestion>();
  const [loadError, setLoadError] = useState<string>();
  const [python, setPython] = useState<DiscoverResult>();
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [saveError, setSaveError] = useState<string>();
  const code = useRef("");
  /** The question most recently picked; replies for any other question arrived too late and are dropped. */
  const current = useRef<string>(undefined);
  const autosave = useAutosave(setSaveError);

  const openQuestion = useCallback(
    async (id: string) => {
      current.current = id;
      await autosave.flush();
      setRun({ kind: "idle" });
      try {
        const [question, initialCode] = await Promise.all([api.loadQuestion(id), api.readSolution(id)]);
        if (current.current !== id) return;
        code.current = initialCode;
        setOpen({ question, initialCode });
        setLoadError(undefined);
      } catch (e) {
        if (current.current !== id) return;
        setOpen(undefined);
        setLoadError(errorMessage(e));
      }
    },
    [autosave],
  );

  useEffect(() => {
    void api.detectPython().then(setPython);
    void api.listQuestions().then((list) => {
      setQuestions(list);
      const first = list.find((q) => q.ok);
      if (first) void openQuestion(first.id);
    });
  }, [openQuestion]);

  /** A run is in progress, possibly for a question the user has since left; one run at a time. */
  const [running, setRunning] = useState(false);
  /** Set synchronously, so a shortcut pressed twice in a row cannot start two runs. */
  const busy = useRef(false);
  /** Numbers the app's runs, so late results of an earlier run are ignored. */
  const runSeq = useRef(0);

  /** Saves, then runs the sample tests (`run`) or every test (`submit`), showing results as they finish. */
  const startRun = async (mode: RunMode) => {
    if (!open || busy.current) return;
    busy.current = true;
    setRunning(true);
    const { id } = open.question;
    const runId = ++runSeq.current;
    autosave.cancel(); // The run saves the code itself.
    setRun({ kind: "active", runId, mode, results: [], finished: false });
    /** Updates the run state only while it still shows this run (the user may have switched question). */
    const updateThisRun = (next: (s: Extract<RunState, { kind: "active" }>) => RunState) =>
      setRun((s) => (s.kind === "active" && s.runId === runId ? next(s) : s));
    try {
      const report = await api.run(id, code.current, mode, (result) =>
        updateThisRun((s) => ({ ...s, results: [...s.results, result] })),
      );
      updateThisRun((s) => ({ ...s, results: report.results, finished: true }));
    } catch (e) {
      updateThisRun(() => ({ kind: "failed", mode, message: errorMessage(e) }));
    } finally {
      busy.current = false;
      setRunning(false);
    }
  };

  // Capture phase, so the editor never sees the shortcut (Monaco binds Ctrl+Enter itself).
  const startRunRef = useRef(startRun);
  startRunRef.current = startRun;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mode = shortcutAction(e, IS_MAC);
      if (!mode) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) void startRunRef.current(mode);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <div className="app">
      <header className="top-bar">
        <select
          value={open?.question.id ?? ""}
          onChange={(e) => void openQuestion(e.target.value)}
          aria-label="Question"
        >
          {questions.map((q) =>
            q.ok ? (
              <option key={q.id} value={q.id}>
                {q.id}. {q.title} — {q.difficulty} · {q.targetMinutes} min
              </option>
            ) : (
              <option key={q.id} value={q.id} disabled>
                {q.id}. ({q.folder} is malformed)
              </option>
            ),
          )}
        </select>
        {saveError && <span className="save-error">Autosave failed: {saveError}</span>}
        <span className="python-status">
          {python === undefined ? "Finding Python…" : python.ok ? `Python ${python.python.version}` : python.error}
        </span>
        <button
          type="button"
          className="secondary"
          onClick={() => void startRun("run")}
          disabled={!open || running}
          title={`Run the sample tests (${MOD}+')`}
        >
          Run
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void startRun("submit")}
          disabled={!open || running}
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
            <p className="placeholder">{loadError ?? "Loading…"}</p>
          )}
        </Panel>
        <Separator className="separator vertical" />
        <Panel minSize="20">
          <Group orientation="vertical">
            <Panel defaultSize="65" minSize="10">
              {open && (
                <Editor
                  key={open.question.id}
                  language="python"
                  defaultValue={open.initialCode}
                  theme={dark ? "vs-dark" : "light"}
                  options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true, tabSize: 4 }}
                  onChange={(value) => {
                    code.current = value ?? "";
                    autosave.schedule(open.question.id, code.current);
                  }}
                />
              )}
            </Panel>
            <Separator className="separator horizontal" />
            <Panel minSize="10">
              <Results
                question={open?.question}
                state={run}
                hint={`Run (${MOD}+') checks the sample tests; Submit (${MOD}+Enter) runs every test, including hidden ones.`}
              />
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}

/**
 * Saves the editor's code a moment after the last keystroke; `flush` saves any pending code now.
 * Reports each save's outcome through `onSaved` (an error message, or undefined once a save succeeds).
 */
function useAutosave(onSaved: (error: string | undefined) => void) {
  const pending = useRef<{ id: string; code: string; timer: ReturnType<typeof setTimeout> }>(undefined);
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
        await api.writeSolution(save.id, save.code);
        onSaved(undefined);
      } catch (e) {
        onSaved(errorMessage(e));
      }
    };
    const schedule = (id: string, code: string) => {
      clearTimeout(pending.current?.timer);
      pending.current = { id, code, timer: setTimeout(() => void flush(), AUTOSAVE_DELAY_MS) };
    };
    /** Saves synchronously: an async save started while the window closes may never land. */
    const flushNow = () => {
      const save = cancel();
      if (save) api.writeSolutionSync(save.id, save.code);
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

/** IPC errors arrive as "Error invoking remote method 'x': Error: <message>". */
function errorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  return message.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, "");
}

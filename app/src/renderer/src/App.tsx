import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { DiscoverResult, IdeMode, LspStatus, QuestionSummary, QuestionView, RunMode, Settings } from "../../shared/api";
import { CUSTOM_STDIN_ID, CustomRun, type CustomState } from "./CustomRun";
import { Results, type RunState } from "./Results";
import { applyIdeMode, setPyrightAvailable, trackEditor } from "./monaco";
import { SettingsDialog } from "./SettingsDialog";
import { shortcutAction } from "./shortcuts";
import { Statement } from "./Statement";
import { Stopwatch } from "./Stopwatch";
import { useDarkMode } from "./useDarkMode";

const IDE_MODE_OPTIONS: { mode: IdeMode; label: string; title: string }[] = [
  { mode: "full", label: "Full IDE", title: "Pyright completion, hover, signature help and error squiggles" },
  { mode: "hackerrank", label: "HackerRank-like", title: "Only basic keyword and word completion, as on the real screen" },
];

const api = window.hackrank;
const AUTOSAVE_DELAY_MS = 500;
const IS_MAC = navigator.userAgent.includes("Macintosh");
const MOD = IS_MAC ? "⌘" : "Ctrl";

/** The open question with the code that belongs to it, loaded together so they never mismatch. */
interface OpenQuestion {
  question: QuestionView;
  initialCode: string;
}

type ResultsTab = "tests" | "custom";

export function App() {
  const dark = useDarkMode();
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [open, setOpen] = useState<OpenQuestion>();
  const [loadError, setLoadError] = useState<string>();
  const [python, setPython] = useState<DiscoverResult>();
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [tab, setTab] = useState<ResultsTab>("tests");
  /** Each question's custom stdin, kept while the app is open. */
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<CustomState>({ kind: "idle" });
  const [saveError, setSaveError] = useState<string>();
  const code = useRef("");
  /** The question most recently picked; replies for any other question arrived too late and are dropped. */
  const current = useRef<string>(undefined);
  const autosave = useAutosave(setSaveError);
  const editorRef = useRef<editor.IStandaloneCodeEditor>(undefined);
  /** When each question's stopwatch started (its first keystroke), kept while the app is open. */
  const [startedAt, setStartedAt] = useState<Record<string, number>>({});
  /** The question picked in the dropdown, which may be a malformed one (then nothing is open). */
  const [selectedId, setSelectedId] = useState<string>();
  /** Why the bank could not be listed. */
  const [bankError, setBankError] = useState<string>();
  /** The bank has been listed at least once, so an empty list means an empty bank. */
  const [bankScanned, setBankScanned] = useState(false);
  const [settings, setSettings] = useState<Settings>();
  const [editingSettings, setEditingSettings] = useState(false);

  /** Opens a question, or for a malformed one shows its validation errors instead. */
  const openQuestion = useCallback(
    async (summary: QuestionSummary | undefined) => {
      const id = summary?.id;
      current.current = id;
      setSelectedId(id);
      await autosave.flush();
      setRun({ kind: "idle" });
      setCustom({ kind: "idle" });
      if (!summary?.ok) {
        setOpen(undefined);
        setLoadError(undefined);
        return;
      }
      try {
        const [question, initialCode] = await Promise.all([api.loadQuestion(summary.id), api.readSolution(summary.id)]);
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

  /** Re-scans the bank; on failure (e.g. the bank folder is gone) shows why and lists nothing. */
  const listBank = useCallback(async (): Promise<QuestionSummary[]> => {
    try {
      const list = await api.listQuestions();
      setQuestions(list);
      setBankError(undefined);
      return list;
    } catch (e) {
      setQuestions([]);
      setBankError(errorMessage(e));
      return [];
    } finally {
      setBankScanned(true);
    }
  }, []);

  /** Numbers Python detections, so a slow earlier one cannot overwrite a later one's result. */
  const pythonSeq = useRef(0);

  /** Scans the bank and Python afresh, then opens the selected question if still there, else the first. */
  const loadEnvironment = useCallback(async () => {
    const seq = ++pythonSeq.current;
    setPython(undefined);
    void api.detectPython().then((found) => {
      if (pythonSeq.current === seq) setPython(found);
    });
    const list = await listBank();
    void openQuestion(stillListedOrFirst(list, current.current));
  }, [listBank, openQuestion]);

  useEffect(() => {
    void api.getSettings().then(setSettings);
    void loadEnvironment();
  }, [loadEnvironment]);

  /**
   * Picks up question folders added, fixed or broken since the last scan. The open question is
   * left as it is (its code and results stay) unless its folder is now malformed or gone.
   */
  const refresh = async () => {
    const list = await listBank();
    const target = stillListedOrFirst(list, current.current);
    if (target?.ok && open?.question.id === target.id) return;
    void openQuestion(target);
  };

  const ideMode = settings?.ideMode;
  useEffect(() => {
    if (ideMode) applyIdeMode(ideMode);
  }, [ideMode]);

  // After pyright fails twice the editor falls back to the HackerRank-like features; the saved mode stays.
  const [lspStatus, setLspStatus] = useState<LspStatus>("ready");
  useEffect(() => {
    const apply = (status: LspStatus) => {
      setPyrightAvailable(status === "ready");
      setLspStatus(status);
    };
    const stop = api.onLspStatus(apply);
    void api.lspStatus().then(apply);
    return stop;
  }, []);

  /** Saves and applies the editor mode; on failure the current mode stays. */
  const changeIdeMode = async (mode: IdeMode) => {
    try {
      const saved = await api.setIdeMode(mode);
      // Applied at once, not only by the effect: React may batch a quick switch there and back
      // into no change, while main has stopped the server in between and needs the documents again.
      applyIdeMode(saved.ideMode);
      setSettings(saved);
    } catch (e) {
      console.error("could not switch the editor mode:", e);
    }
  };

  const saveSettings = async (next: Settings) => {
    await autosave.flush(); // pending code belongs to the current bank's workspace
    let saved: Settings;
    try {
      saved = await api.updateSettings(next);
    } catch (e) {
      throw new Error(errorMessage(e));
    }
    if (saved.bankDir !== settings?.bankDir) {
      // Question ids now name another bank's questions.
      current.current = undefined;
      setStartedAt({});
      setCustomInputs({});
    }
    setSettings(saved);
    setEditingSettings(false);
    await loadEnvironment();
  };

  /** A run is in progress, possibly for a question the user has since left; one run at a time. */
  const [running, setRunning] = useState(false);
  /** Set synchronously, so a shortcut pressed twice in a row cannot start two runs. */
  const busy = useRef(false);
  /** Numbers the app's runs, so late results of an earlier run are ignored. */
  const runSeq = useRef(0);

  /**
   * Runs `job` for the open question unless a run is already in progress: Run, Submit and a
   * custom run share one lock, so they never overlap. Each of them saves the code itself.
   */
  const withRunLock = async (job: (question: QuestionView) => Promise<void>) => {
    if (!open || !python?.ok || busy.current) return;
    busy.current = true;
    setRunning(true);
    autosave.cancel();
    try {
      await job(open.question);
    } finally {
      busy.current = false;
      setRunning(false);
    }
  };

  /** Saves, then runs the sample tests (`run`) or every test (`submit`), showing results as they finish. */
  const startRun = (mode: RunMode) =>
    withRunLock(async ({ id }) => {
      setTab("tests");
      const runId = ++runSeq.current;
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
      }
    });

  /** Saves, then runs the code once on the Custom tab's stdin, with no grading. */
  const startCustomRun = () =>
    withRunLock(async ({ id }) => {
      setCustom({ kind: "running" });
      try {
        const result = await api.runCustom(id, code.current, customInputs[id] ?? "");
        if (current.current === id) setCustom({ kind: "done", result });
      } catch (e) {
        if (current.current === id) setCustom({ kind: "failed", message: errorMessage(e) });
      }
    });

  /** After confirmation, empties the editor and the saved file. The stopwatch keeps running. */
  const resetCode = async () => {
    if (!open) return;
    const { id } = open.question;
    // Another question is loading, or a run is grading the saved file: leave the code alone.
    if (current.current !== id || busy.current) return;
    if (!window.confirm(`Reset ${id}? This empties the editor and your saved code for this question.`)) return;
    // The change event queues the empty file's save; flush writes it now.
    editorRef.current?.setValue("");
    await autosave.flush();
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

  const selected = questions.find((q) => q.id === selectedId);
  const malformed = selected && !selected.ok ? selected : undefined;

  return (
    <div className="app">
      <header className="top-bar">
        <select
          value={selectedId ?? ""}
          onChange={(e) => void openQuestion(questions.find((q) => q.id === e.target.value))}
          aria-label="Question"
        >
          {questions.map((q) =>
            q.ok ? (
              <option key={q.id} value={q.id}>
                {q.id}. {q.title} — {q.difficulty} · {q.targetMinutes} min
              </option>
            ) : (
              <option key={q.id} value={q.id}>
                {q.id}. ⚠ {q.folder} is malformed
              </option>
            ),
          )}
        </select>
        <button
          type="button"
          className="secondary"
          onClick={() => void refresh()}
          title="Re-scan the question bank for added or changed questions"
        >
          Refresh
        </button>
        {open && <Stopwatch startedAt={startedAt[open.question.id]} targetMinutes={open.question.targetMinutes} />}
        {saveError && <span className="save-error">Autosave failed: {saveError}</span>}
        <span className="spacer" />
        <button
          type="button"
          className="secondary"
          onClick={() => setEditingSettings(true)}
          disabled={!settings || running}
          title="Question bank folder and Python interpreter"
        >
          Settings
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void resetCode()}
          disabled={!open || running}
          title="Empty the editor and the saved code for this question"
        >
          Reset
        </button>
        <div className="ide-mode" role="group" aria-label="Editor mode">
          {IDE_MODE_OPTIONS.map(({ mode, label, title }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={ideMode === mode}
              onClick={() => void changeIdeMode(mode)}
              disabled={!settings}
              title={title}
            >
              {label}
            </button>
          ))}
        </div>
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
            <NothingOpen bankError={bankError} malformed={malformed} loadError={loadError} empty={bankScanned && questions.length === 0} />
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
                  options={{
                    fontSize: 14,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    tabSize: 4,
                    // wordBasedSuggestions follows the editor mode; see applyIdeMode.
                  }}
                  onMount={(instance) => {
                    editorRef.current = instance;
                    trackEditor(instance, open.question.id);
                  }}
                  onChange={(value, event) => {
                    const { id } = open.question;
                    code.current = value ?? "";
                    autosave.schedule(id, code.current);
                    // A flush is a programmatic replace (Reset), not the user typing.
                    if (!event.isFlush) setStartedAt((all) => (id in all ? all : { ...all, [id]: Date.now() }));
                  }}
                />
              )}
            </Panel>
            <Separator className="separator horizontal" />
            <Panel minSize="10">
              <div className="results-panel">
                <div className="results-tabs" role="tablist" aria-label="Results">
                  <button type="button" role="tab" aria-selected={tab === "tests"} onClick={() => setTab("tests")}>
                    Test results
                  </button>
                  <button type="button" role="tab" aria-selected={tab === "custom"} onClick={() => setTab("custom")}>
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
                      input={customInputs[open.question.id] ?? ""}
                      onInputChange={(input) => setCustomInputs((all) => ({ ...all, [open.question.id]: input }))}
                      state={custom}
                      onRun={() => void startCustomRun()}
                      disabled={running || !python?.ok}
                      shortcut={`${MOD}+Enter`}
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
      <footer className="status-bar">
        <PythonStatus python={python} />
        {ideMode === "full" && lspStatus === "unavailable" && (
          <span className="lsp-status" title="The Pyright server failed twice; basic completion is used instead">
            Python IDE features unavailable
          </span>
        )}
        {settings && (
          <span className="bank-path" title={settings.bankDir}>
            Bank: {settings.bankDir}
          </span>
        )}
      </footer>
      {editingSettings && settings && (
        <SettingsDialog initial={settings} onSave={saveSettings} onClose={() => setEditingSettings(false)} />
      )}
    </div>
  );
}

/** The question `id` if the bank still lists it, else the first loadable one. */
function stillListedOrFirst(list: QuestionSummary[], id: string | undefined): QuestionSummary | undefined {
  return list.find((q) => q.id === id) ?? list.find((q) => q.ok);
}

/** The interpreter runs use, or why there is none and how to fix it. */
function PythonStatus({ python }: { python: DiscoverResult | undefined }) {
  if (python === undefined) return <span className="python-status">Finding Python…</span>;
  if (!python.ok) {
    return (
      <span className="python-status error" role="alert">
        {python.error} Run and Submit are disabled until then.
      </span>
    );
  }
  return (
    <span className="python-status" title={python.python.path}>
      Python {python.python.version} · {python.python.path}
    </span>
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

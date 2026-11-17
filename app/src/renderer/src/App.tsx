import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoverResult, IdeMode, LspStatus, QuestionSummary, Settings } from "../../shared/api";
import { errorMessage } from "./errors";
import { applyIdeMode, setPyrightAvailable } from "./monaco";
import { SettingsDialog } from "./SettingsDialog";
import { TestScreen, useRunLock, type ResultsTab, type TestScreenHandle } from "./TestScreen";

const IDE_MODE_OPTIONS: { mode: IdeMode; label: string; title: string }[] = [
  { mode: "hackerrank", label: "HackerRank-like", title: "Only basic keyword and word completion, as on the real screen" },
  { mode: "full", label: "Full IDE", title: "Pyright completion, hover, signature help and error squiggles" },
];

const api = window.hackrank;

/** The question the screen opens, and which opening this is: each one mounts a fresh screen. */
interface Opened {
  summary: QuestionSummary | undefined;
  seq: number;
}

export function App() {
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [python, setPython] = useState<DiscoverResult>();
  const [tab, setTab] = useState<ResultsTab>("tests");
  /** Each question's custom stdin, kept while the app is open. */
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string>();
  /** The question most recently picked; an opening overtaken by a later pick is dropped. */
  const current = useRef<string>(undefined);
  /** Questions whose reference the user has confirmed revealing, kept while the app is open. */
  const revealed = useRef(new Set<string>());
  /** When each question's stopwatch started (its first keystroke), kept while the app is open. */
  const [startedAt, setStartedAt] = useState<Record<string, number>>({});
  /** The question picked in the dropdown, which may be a malformed one (then nothing is open). */
  const [selectedId, setSelectedId] = useState<string>();
  const [opened, setOpened] = useState<Opened>({ summary: undefined, seq: 0 });
  const screen = useRef<TestScreenHandle>(null);
  /** Why the bank could not be listed. */
  const [bankError, setBankError] = useState<string>();
  /** The bank has been listed at least once, so an empty list means an empty bank. */
  const [bankScanned, setBankScanned] = useState(false);
  const [settings, setSettings] = useState<Settings>();
  const [editingSettings, setEditingSettings] = useState(false);
  const lock = useRunLock();

  /**
   * Opens a question, or for a malformed one shows its validation errors instead: saves the
   * screen's pending code, then replaces the screen with a fresh one for `summary`.
   */
  const openQuestion = useCallback(async (summary: QuestionSummary | undefined) => {
    const id = summary?.id;
    current.current = id;
    setSelectedId(id);
    await screen.current?.flush();
    if (current.current !== id) return;
    setOpened((o) => ({ summary, seq: o.seq + 1 }));
  }, []);

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
    if (target?.ok && screen.current?.isOpen(target.id)) return;
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
    await screen.current?.flush(); // pending code belongs to the current bank's workspace
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
      revealed.current.clear();
    }
    setSettings(saved);
    setEditingSettings(false);
    await loadEnvironment();
  };

  const openId = opened.summary?.id;

  return (
    <div className="app">
      <TestScreen
        key={opened.seq}
        ref={screen}
        summary={opened.summary}
        bankError={bankError}
        bankEmpty={bankScanned && questions.length === 0}
        python={python}
        lock={lock}
        startedAt={openId === undefined ? undefined : startedAt[openId]}
        onStartStopwatch={() => {
          if (openId === undefined) return;
          setStartedAt((all) => (openId in all ? all : { ...all, [openId]: Date.now() }));
        }}
        customInput={openId === undefined ? "" : (customInputs[openId] ?? "")}
        onCustomInputChange={(input) => {
          if (openId !== undefined) setCustomInputs((all) => ({ ...all, [openId]: input }));
        }}
        revealed={revealed.current}
        tab={tab}
        onTabChange={setTab}
        saveError={saveError}
        onSaved={setSaveError}
        toolbarStart={
          <>
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
          </>
        }
        settingsButton={
          <button
            type="button"
            className="secondary"
            onClick={() => setEditingSettings(true)}
            disabled={!settings || lock.running}
            title="Question bank folder and Python interpreter"
          >
            Settings
          </button>
        }
        ideModeSwitch={
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
        }
      />
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

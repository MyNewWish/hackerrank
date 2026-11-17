import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoverResult, IdeMode, LspStatus, QuestionSummary, Settings } from "../../shared/api";
import { errorMessage } from "./errors";
import { Home, type OkSummary } from "./Home";
import { NO_FILTER, questionList, type QuestionFilter } from "./question-list-model";
import { applyIdeMode, setPyrightAvailable } from "./monaco";
import { SettingsDialog } from "./SettingsDialog";
import { loadOpening, TestScreen, useRunLock, type Opening, type ResultsTab, type TestScreenHandle } from "./TestScreen";

const IDE_MODE_OPTIONS: { mode: IdeMode; label: string; title: string }[] = [
  { mode: "hackerrank", label: "HackerRank-like", title: "Only basic keyword and word completion, as on the real screen" },
  { mode: "full", label: "Full IDE", title: "Pyright completion, hover, signature help and error squiggles" },
];

const api = window.hackrank;

/**
 * Which screen is shown: Home, or test mode for one attempt at a question. Each attempt has its
 * own `seq`, which mounts a fresh test screen, and its own stopwatch start.
 */
type Screen = { kind: "home" } | { kind: "test"; summary: OkSummary; opening: Opening; startedAt: number; seq: number };

export function App() {
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [python, setPython] = useState<DiscoverResult>();
  const [tab, setTab] = useState<ResultsTab>("tests");
  /** Each question's custom stdin, kept while the app is open. */
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string>();
  /** Questions whose reference the user has confirmed revealing, kept while the app is open. */
  const revealed = useRef(new Set<string>());
  /** The question selected on Home, kept across test mode; may be a malformed one. */
  const [selectedId, setSelectedId] = useState<string>();
  /** Home's search, tag chips and difficulty, kept across test mode but not across restarts. */
  const [filter, setFilter] = useState<QuestionFilter>(NO_FILTER);
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  /** Numbers attempts, so each Start testing mounts a fresh test screen. */
  const attemptSeq = useRef(0);
  /** A question is being loaded for Start testing; set synchronously so a double click starts one attempt. */
  const starting = useRef(false);
  /** `starting`, as state for rendering: Start testing and Settings wait while it is set. */
  const [startPending, setStartPending] = useState(false);
  const testScreen = useRef<TestScreenHandle>(null);
  /** Why the bank could not be listed. */
  const [bankError, setBankError] = useState<string>();
  /** The bank has been listed at least once, so an empty list means an empty bank. */
  const [bankScanned, setBankScanned] = useState(false);
  const [settings, setSettings] = useState<Settings>();
  const [editingSettings, setEditingSettings] = useState(false);
  const lock = useRunLock();

  /** Numbers bank scans, so a slow earlier scan cannot overwrite a later one's list. */
  const bankSeq = useRef(0);

  /** Re-scans the bank, picking up folders added, fixed or broken; on failure shows why and lists nothing. */
  const listBank = useCallback(async () => {
    const seq = ++bankSeq.current;
    try {
      const list = await api.listQuestions();
      if (bankSeq.current !== seq) return;
      setQuestions(list);
      setBankError(undefined);
    } catch (e) {
      if (bankSeq.current !== seq) return;
      setQuestions([]);
      setBankError(errorMessage(e));
    }
    setBankScanned(true);
  }, []);

  /** Forgets the listed bank and drops any scan in flight, so another bank's ids never show. */
  const clearBank = () => {
    bankSeq.current++;
    setQuestions([]);
    setBankError(undefined);
    setBankScanned(false);
  };

  /** Numbers Python detections, so a slow earlier one cannot overwrite a later one's result. */
  const pythonSeq = useRef(0);

  /** Scans the bank and Python afresh. */
  const loadEnvironment = useCallback(async () => {
    const seq = ++pythonSeq.current;
    setPython(undefined);
    void api.detectPython().then((found) => {
      if (pythonSeq.current === seq) setPython(found);
    });
    await listBank();
  }, [listBank]);

  useEffect(() => {
    void api.getSettings().then(setSettings);
    void loadEnvironment();
  }, [loadEnvironment]);

  // Coming back to the window counts as returning to Home: a folder fixed or added in another
  // app shows up then, even when an empty or broken bank leaves nothing to start.
  const onHome = screen.kind === "home";
  useEffect(() => {
    if (!onHome) return;
    const rescan = () => void listBank();
    window.addEventListener("focus", rescan);
    return () => window.removeEventListener("focus", rescan);
  }, [onHome, listBank]);

  /** Opens test mode for `summary` with its saved solution, starting a new stopwatch from zero. */
  const startTesting = async (summary: OkSummary) => {
    if (starting.current) return;
    starting.current = true;
    setStartPending(true);
    try {
      const opening = await loadOpening(summary.id);
      // Timed from when test mode appears, so it opens at 0:00 however long the load took.
      setScreen({ kind: "test", summary, opening, startedAt: Date.now(), seq: ++attemptSeq.current });
    } finally {
      starting.current = false;
      setStartPending(false);
    }
  };

  /**
   * After confirmation, ends the attempt: saves pending code, then unmounts the test screen, which
   * drops any in-flight run's late results and closes its pyright documents. The time is discarded.
   */
  const goHome = async () => {
    if (screen.kind !== "test") return;
    const ask = `Go back to Home? This ends your timed attempt at ${screen.summary.id}. Your code is saved.`;
    if (!window.confirm(ask)) return;
    await testScreen.current?.flush();
    setScreen({ kind: "home" });
    void listBank();
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

  /** Settings are edited on Home only, so no question is open and no code is pending. */
  const saveSettings = async (next: Settings) => {
    let saved: Settings;
    try {
      saved = await api.updateSettings(next);
    } catch (e) {
      throw new Error(errorMessage(e));
    }
    if (saved.bankDir !== settings?.bankDir) {
      // Question ids now name another bank's questions.
      setSelectedId(undefined);
      // Its tags may not exist in the new bank.
      setFilter(NO_FILTER);
      // Now, not when the new scan lands.
      clearBank();
      setCustomInputs({});
      revealed.current.clear();
    }
    setSettings(saved);
    setEditingSettings(false);
    await loadEnvironment();
  };

  return (
    <div className="app">
      {screen.kind === "home" ? (
        <Home
          questions={questions}
          bankError={bankError}
          bankEmpty={bankScanned && questions.length === 0}
          filter={filter}
          onFilterChange={(next) => {
            setFilter(next);
            // A question the new filter hides is no longer selected.
            setSelectedId(questionList(questions, next, selectedId).selectedId);
          }}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onStart={(summary) => void startTesting(summary)}
          starting={startPending}
          settingsButton={
            <button
              type="button"
              className="secondary"
              onClick={() => setEditingSettings(true)}
              disabled={!settings || lock.running || startPending}
              title="Question bank folder and Python interpreter"
            >
              Settings
            </button>
          }
        />
      ) : (
        <TestScreen
          key={screen.seq}
          ref={testScreen}
          opening={screen.opening}
          python={python}
          lock={lock}
          startedAt={screen.startedAt}
          customInput={customInputs[screen.summary.id] ?? ""}
          onCustomInputChange={(input) => {
            const { id } = screen.summary;
            setCustomInputs((all) => ({ ...all, [id]: input }));
          }}
          revealed={revealed.current}
          tab={tab}
          onTabChange={setTab}
          saveError={saveError}
          onSaved={setSaveError}
          toolbarStart={
            <>
              <button
                type="button"
                className="secondary"
                onClick={() => void goHome()}
                title="End this attempt and go back to the question list"
              >
                Home
              </button>
              <span className="question-name">
                {screen.summary.id}. {screen.summary.title}
              </span>
            </>
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
      )}
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

// The contract between the renderer and the main process. Only types, constants and pure helpers: safe to import anywhere.
import type { DiscoverResult } from "../judge/python";
import type { LspStatus } from "../lsp/host";
import type { ProgramResult, RunReport, TestResult, TestStatus } from "../judge/runner";
import type { Difficulty, RunMode, TestKind, ValidationError } from "../judge/types";
import type {
  CompletionItem,
  CompletionList,
  Diagnostic,
  Hover,
  Position,
  SignatureHelp,
  SignatureHelpContext,
} from "vscode-languageserver-protocol";

export type {
  CompletionItem,
  CompletionList,
  Diagnostic,
  DiscoverResult,
  Hover,
  LspStatus,
  Position,
  RunMode,
  SignatureHelp,
  SignatureHelpContext,
  TestKind,
  TestStatus,
};
// Pure and dependency-free, so the renderer plans a run by the same rule the judge runs it by.
export { RUN_MODES, runsTest } from "../judge/types";

/** A finished test with the data it was graded on, for the results detail pane. */
export interface GradedTest extends TestResult {
  input: string;
  expected: string;
}

/** A run's report, with each result carrying its test's input and expected output. */
export interface GradedReport extends Omit<RunReport, "results"> {
  results: GradedTest[];
}

/**
 * One ungraded run on the candidate's own stdin. `ok` = exited 0; `error` = non-zero exit or
 * output limit; `timeout` = stopped at the question's time limit.
 */
export interface CustomRunResult extends Omit<ProgramResult, "status"> {
  status: Exclude<ProgramResult["status"], "cancelled">;
}

/** User settings, persisted by the main process. */
export interface Settings {
  /** The question bank folder; the workspace is its sibling `workspace/` folder. */
  bankDir: string;
  /** Python interpreter to use; empty = auto-detect. */
  pythonPath: string;
  /** The editor's Python features: pyright (`full`), or only basic completion as on HackerRank. */
  ideMode: IdeMode;
}

export const IDE_MODES = ["full", "hackerrank"] as const;
export type IdeMode = (typeof IDE_MODES)[number];

export type QuestionSummary =
  | { id: string; ok: true; title: string; difficulty: Difficulty; targetMinutes: number }
  | { id: string; ok: false; folder: string; errors: ValidationError[] };

export interface QuestionView {
  id: string;
  title: string;
  difficulty: Difficulty;
  targetMinutes: number;
  /** `problem.md`, with `## Part N` headings. */
  statement: string;
  /** Each part's tests in run order: ids and kinds only, the test data stays in the main process. */
  parts: { id: string; title: string; tests: { id: string; kind: TestKind }[] }[];
}

/** IPC channel names, one per API method. */
export const CHANNELS = {
  listQuestions: "questions:list",
  loadQuestion: "question:load",
  readSolution: "solution:read",
  writeSolution: "solution:write",
  writeSolutionSync: "solution:write-sync",
  run: "run",
  runCustom: "run:custom",
  /** Main → renderer: one finished test of a run, as `(runId, GradedTest)`. */
  runResult: "run:result",
  detectPython: "python:detect",
  getSettings: "settings:get",
  updateSettings: "settings:update",
  setIdeMode: "settings:set-ide-mode",
  lspOpen: "lsp:open",
  lspChange: "lsp:change",
  lspClose: "lsp:close",
  lspCompletion: "lsp:completion",
  lspResolveCompletion: "lsp:resolve-completion",
  lspHover: "lsp:hover",
  lspSignatureHelp: "lsp:signature-help",
  /** Main → renderer: an open document's full set of diagnostics, as `(id, Diagnostic[])`. */
  lspDiagnostics: "lsp:diagnostics",
  /** Renderer → main: the server's current `LspStatus`. */
  lspStatus: "lsp:status",
  /** Main → renderer: the server's new `LspStatus` each time it changes. */
  lspStatusChanged: "lsp:status-changed",
} as const;

/**
 * Everything the renderer may ask of the main process, exposed as `window.hackrank` by the
 * preload script. The renderer has no other access to files or processes.
 */
export interface HackrankApi {
  listQuestions(): Promise<QuestionSummary[]>;
  loadQuestion(id: string): Promise<QuestionView>;
  /** Empty for a never-attempted question. */
  readSolution(id: string): Promise<string>;
  writeSolution(id: string, code: string): Promise<void>;
  /** Blocks until saved; only for when the window is closing and an async save could be cut off. */
  writeSolutionSync(id: string, code: string): void;
  /**
   * Saves `code`, then grades it: `run` = sample tests only, `submit` = sample and hidden tests.
   * `onResult` is called as each test finishes, before the returned report resolves.
   */
  run(id: string, code: string, mode: RunMode, onResult: (result: GradedTest) => void): Promise<GradedReport>;
  /** Saves `code`, then runs it once on `stdin` with no grading. */
  runCustom(id: string, code: string, stdin: string): Promise<CustomRunResult>;
  /** The interpreter runs use: the configured path, else the first Python 3 found. */
  detectPython(): Promise<DiscoverResult>;
  /** The saved settings with blanks filled in by the defaults. */
  getSettings(): Promise<Settings>;
  /**
   * Validates and saves `settings` (blank fields = defaults), then switches the bank and Python
   * to them. Rejects, changing nothing, if the bank folder does not exist.
   */
  updateSettings(settings: Settings): Promise<Settings>;
  /**
   * Saves the editor mode and returns the settings; the bank folder is not checked again.
   * Switching to `hackerrank` stops the pyright server; the next `lspOpen` in `full` starts it.
   */
  setIdeMode(mode: IdeMode): Promise<Settings>;

  // Python language features, from a pyright server the main process starts on the first `lspOpen`
  // in the full IDE mode (`lspOpen` does nothing in the HackerRank-like mode).
  // Each open question is one in-memory document; the server never reads the saved file.
  /** Opens question `id`'s document with the editor's text. */
  lspOpen(id: string, text: string): void;
  /** Sends the document's whole new text. */
  lspChange(id: string, text: string): void;
  lspClose(id: string): void;
  /** Completions at a 0-based LSP position; empty if the server is unavailable. */
  lspCompletion(id: string, position: Position): Promise<CompletionList>;
  /** Adds an item's documentation; the item unchanged if the server is unavailable. */
  lspResolveCompletion(item: CompletionItem): Promise<CompletionItem>;
  /** What the name at a 0-based LSP position is; null if nothing or the server is unavailable. */
  lspHover(id: string, position: Position): Promise<Hover | null>;
  /** The call around a 0-based LSP position; null outside a call or if the server is unavailable. */
  lspSignatureHelp(id: string, position: Position, context: SignatureHelpContext): Promise<SignatureHelp | null>;
  /**
   * Calls `listener` with a document's full set of diagnostics each time the server publishes
   * them; an empty set clears them. Advisory only. Returns a function that removes the listener.
   */
  onLspDiagnostics(listener: (id: string, diagnostics: Diagnostic[]) => void): () => void;
  /**
   * `unavailable` once the server has failed twice: the editor then falls back to the
   * HackerRank-like features, without changing the saved mode, until `setIdeMode("hackerrank")`.
   */
  lspStatus(): Promise<LspStatus>;
  /** Calls `listener` each time the status changes. Returns a function that removes the listener. */
  onLspStatus(listener: (status: LspStatus) => void): () => void;
}

// Monaco is bundled with the app instead of fetched from a CDN, so the editor works offline.
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { pythonCompletions, type CompletionKind } from "./completion";
import type { IdeMode } from "../../shared/api";
import {
  attachPyright,
  registerPyrightCompletion,
  registerPyrightHover,
  registerPyrightSignatureHelp,
  showPyrightDiagnostics,
} from "./lsp/providers";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

const KIND = {
  keyword: monaco.languages.CompletionItemKind.Keyword,
  builtin: monaco.languages.CompletionItemKind.Function,
  snippet: monaco.languages.CompletionItemKind.Snippet,
  identifier: monaco.languages.CompletionItemKind.Variable,
} satisfies Record<CompletionKind, monaco.languages.CompletionItemKind>;

/**
 * Registers the static Python completion; dispose the result to remove it (e.g. when a language
 * server takes over). Monaco skips its own word-based suggestions whenever a language's provider
 * answers, so this provider offers the file's identifiers itself.
 */
export function registerStaticPythonCompletion(): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("python", { provideCompletionItems });
}

function provideCompletionItems(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): monaco.languages.CompletionList {
  const word = model.getWordUntilPosition(position);
  // After a `.` only attributes make sense, and this static list knows none.
  if (model.getLineContent(position.lineNumber)[word.startColumn - 2] === ".") return { suggestions: [] };
  const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
  const wordAtCursor = model.getWordAtPosition(position)?.word ?? "";
  return {
    suggestions: pythonCompletions(model.getValue(), wordAtCursor).map((c) => ({
      label: c.label,
      kind: KIND[c.kind],
      insertText: c.insertText,
      detail: c.detail,
      range,
      ...(c.kind === "snippet" && {
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      }),
    })),
  };
}

/** An editor on screen: the question it shows, and its pyright attachment in the full IDE. */
interface TrackedEditor {
  id: string;
  pyright?: monaco.IDisposable;
}
const editors = new Map<monaco.editor.IStandaloneCodeEditor, TrackedEditor>();
/** The mode's providers; none until the saved mode is known. */
let mode: IdeMode | undefined;
let providers: monaco.IDisposable[] = [];

/**
 * Gives `editor` (showing question `id`) the current mode's Python features, and follows later
 * switches until it is disposed.
 */
export function trackEditor(editor: monaco.editor.IStandaloneCodeEditor, id: string): void {
  const entry: TrackedEditor = { id };
  editors.set(editor, entry);
  editor.onDidDispose(() => {
    entry.pyright?.dispose();
    editors.delete(editor);
  });
  if (mode !== undefined) applyTo(editor, entry, mode);
}

/**
 * Switches the editor's Python features. `full`: pyright's completion, hover, signature help and
 * diagnostics, with Monaco's word suggestions off since pyright's completions include the file's
 * names. `hackerrank`: only the static completion and word suggestions, as on the real screen.
 */
export function applyIdeMode(next: IdeMode): void {
  if (next === mode) return;
  mode = next;
  for (const p of providers) p.dispose();
  providers =
    next === "full"
      ? [registerPyrightCompletion(), registerPyrightHover(), registerPyrightSignatureHelp(), showPyrightDiagnostics()]
      : [registerStaticPythonCompletion()];
  for (const [editor, entry] of editors) applyTo(editor, entry, next);
}

function applyTo(
  editor: monaco.editor.IStandaloneCodeEditor,
  entry: TrackedEditor,
  to: IdeMode,
): void {
  editor.updateOptions({ wordBasedSuggestions: to === "full" ? "off" : "matchingDocuments" });
  if (to === "full") entry.pyright ??= attachPyright(editor, entry.id);
  else {
    entry.pyright?.dispose();
    entry.pyright = undefined;
  }
}

// In development, a hot reload of this module must not leave the old providers registered too.
import.meta.hot?.dispose(() => {
  for (const p of providers) p.dispose();
  for (const entry of editors.values()) entry.pyright?.dispose();
});

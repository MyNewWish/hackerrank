// Monaco is bundled with the app instead of fetched from a CDN, so the editor works offline.
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { pythonCompletions, type CompletionKind } from "./completion";
import { registerPyrightCompletion, registerPyrightHover, registerPyrightSignatureHelp, showPyrightDiagnostics } from "./lsp/providers";

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

// Pyright supplies Python completion; the static provider returns with the HackerRank-like mode.
const completion = registerPyrightCompletion();
const hover = registerPyrightHover();
const signatureHelp = registerPyrightSignatureHelp();
const diagnostics = showPyrightDiagnostics();
// In development, a hot reload of this module must not leave the old providers registered too.
import.meta.hot?.dispose(() => {
  completion.dispose();
  hover.dispose();
  signatureHelp.dispose();
  diagnostics.dispose();
});

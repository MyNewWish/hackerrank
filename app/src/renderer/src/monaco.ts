// Monaco is bundled with the app instead of fetched from a CDN, so the editor works offline.
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { pythonCompletions, type CompletionKind } from "./completion";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

const KIND = {
  keyword: monaco.languages.CompletionItemKind.Keyword,
  builtin: monaco.languages.CompletionItemKind.Function,
  snippet: monaco.languages.CompletionItemKind.Snippet,
  identifier: monaco.languages.CompletionItemKind.Variable,
} satisfies Record<CompletionKind, monaco.languages.CompletionItemKind>;

// Static Python completion. Monaco skips its own word-based suggestions whenever a language's
// provider answers, so this provider offers the file's identifiers itself. A language server
// would register its own provider here instead.
monaco.languages.registerCompletionItemProvider("python", {
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position);
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
  },
});

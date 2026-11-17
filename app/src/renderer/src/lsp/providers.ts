// Monaco's Python language features from pyright, through the preload API.
import * as monaco from "monaco-editor";
import type { CompletionItem } from "../../../shared/api";
import { toLspPosition, toMonacoCompletion, toMonacoDocumentation } from "./convert";

const api = window.hackrank;

/** The question each attached editor's model belongs to. */
const documents = new WeakMap<monaco.editor.ITextModel, string>();
/** The server's item behind each suggestion, needed to resolve it. */
const serverItems = new WeakMap<monaco.languages.CompletionItem, CompletionItem>();

/**
 * Makes `editor`'s text question `id`'s document on the server, for as long as the editor lives:
 * opened now, sent in full on every edit, closed when the editor is disposed.
 */
export function attachPyright(editor: monaco.editor.IStandaloneCodeEditor, id: string): void {
  const model = editor.getModel();
  if (!model) return;
  documents.set(model, id);
  api.lspOpen(id, model.getValue());
  const changes = model.onDidChangeContent(() => api.lspChange(id, model.getValue()));
  editor.onDidDispose(() => {
    changes.dispose();
    documents.delete(model);
    api.lspClose(id);
  });
}

/** Registers pyright completion for Python; dispose the result to remove it. */
export function registerPyrightCompletion(): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("python", {
    triggerCharacters: ["."],
    async provideCompletionItems(model, position, _context, token) {
      const id = documents.get(model);
      if (id === undefined) return { suggestions: [] };
      const word = model.getWordUntilPosition(position);
      const wordRange = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const list = await api.lspCompletion(id, toLspPosition(position)).catch(() => undefined);
      if (!list || token.isCancellationRequested) return { suggestions: [] };
      return {
        incomplete: list.isIncomplete,
        suggestions: list.items.map((item) => {
          const { kindName, ...rest } = toMonacoCompletion(item, wordRange);
          const suggestion = { ...rest, kind: monaco.languages.CompletionItemKind[kindName] };
          serverItems.set(suggestion, item);
          return suggestion;
        }),
      };
    },
    async resolveCompletionItem(suggestion) {
      const item = serverItems.get(suggestion);
      if (!item) return suggestion;
      const resolved = await api.lspResolveCompletion(item).catch(() => item);
      return {
        ...suggestion,
        detail: resolved.detail ?? suggestion.detail,
        documentation: toMonacoDocumentation(resolved.documentation) ?? suggestion.documentation,
      };
    },
  });
}

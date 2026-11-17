// Monaco's Python language features from pyright, through the preload API.
import * as monaco from "monaco-editor";
import type { CompletionItem } from "../../../shared/api";
import {
  toLspPosition,
  toMonacoCompletion,
  toMonacoDocumentation,
  toMonacoHover,
  toMonacoMarker,
  toMonacoSignatureHelp,
} from "./convert";

const api = window.hackrank;

/** The question each attached editor's model belongs to. */
const documents = new WeakMap<monaco.editor.ITextModel, string>();
/** The model of each attached question, for routing diagnostics to it. */
const models = new Map<string, monaco.editor.ITextModel>();
/** Owner of pyright's markers, so clearing them leaves other owners' alone. */
const MARKER_OWNER = "pyright";

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
  models.set(id, model);
  api.lspOpen(id, model.getValue());
  const changes = model.onDidChangeContent(() => api.lspChange(id, model.getValue()));
  editor.onDidDispose(() => {
    changes.dispose();
    documents.delete(model);
    // A newer editor for the same question may have taken the entry already.
    if (models.get(id) === model) models.delete(id);
    monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
    api.lspClose(id);
  });
}

/**
 * Shows pyright's diagnostics as markers on the attached editors; dispose the result to stop.
 * Diagnostics for a question with no editor (one just switched away from) are dropped.
 */
export function showPyrightDiagnostics(): monaco.IDisposable {
  const stop = api.onLspDiagnostics((id, diagnostics) => {
    const model = models.get(id);
    if (!model || model.isDisposed()) return;
    monaco.editor.setModelMarkers(
      model,
      MARKER_OWNER,
      diagnostics.map((diagnostic) => {
        const { severityName, tagNames, ...marker } = toMonacoMarker(diagnostic);
        return {
          ...marker,
          severity: monaco.MarkerSeverity[severityName],
          tags: tagNames.map((name) => monaco.MarkerTag[name]),
        };
      }),
    );
  });
  return { dispose: stop };
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

/** Registers pyright hover for Python; dispose the result to remove it. */
export function registerPyrightHover(): monaco.IDisposable {
  return monaco.languages.registerHoverProvider("python", {
    async provideHover(model, position, token) {
      const id = documents.get(model);
      if (id === undefined) return undefined;
      const hover = await api.lspHover(id, toLspPosition(position)).catch(() => null);
      if (!hover || token.isCancellationRequested) return undefined;
      return toMonacoHover(hover);
    },
  });
}

/**
 * Registers pyright signature help for Python: parameter hints open on `(`, move on `,` and close
 * on `)`, the server deciding each time which parameter is active. Dispose the result to remove it.
 */
export function registerPyrightSignatureHelp(): monaco.IDisposable {
  return monaco.languages.registerSignatureHelpProvider("python", {
    signatureHelpTriggerCharacters: ["(", ","],
    signatureHelpRetriggerCharacters: [")"],
    async provideSignatureHelp(model, position, token, context) {
      const id = documents.get(model);
      if (id === undefined) return undefined;
      // Monaco's trigger kinds share LSP's values.
      const { triggerKind, triggerCharacter, isRetrigger } = context;
      const help = await api
        .lspSignatureHelp(id, toLspPosition(position), { triggerKind, triggerCharacter, isRetrigger })
        .catch(() => null);
      if (!help || help.signatures.length === 0 || token.isCancellationRequested) return undefined;
      return { value: toMonacoSignatureHelp(help), dispose() {} };
    },
  });
}

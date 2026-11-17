// Pure LSP → Monaco conversions. Only types come from Monaco, so this runs under `bun test`;
// enum values are named here and looked up in `providers.ts`.
import type { editor, IMarkdownString, IPosition, IRange, languages, MarkerSeverity, MarkerTag } from "monaco-editor";
import type {
  CompletionItem,
  Diagnostic,
  Hover,
  MarkedString,
  MarkupContent,
  Position,
  Range,
  SignatureHelp,
} from "vscode-languageserver-protocol";

export type CompletionKindName = keyof typeof languages.CompletionItemKind;

/** LSP `CompletionItemKind` values (1-based) by name; Monaco uses the same names. */
const LSP_KINDS: CompletionKindName[] = [
  "Text", "Method", "Function", "Constructor", "Field", "Variable", "Class", "Interface", "Module",
  "Property", "Unit", "Value", "Enum", "Keyword", "Snippet", "Color", "File", "Reference", "Folder",
  "EnumMember", "Constant", "Struct", "Event", "Operator", "TypeParameter",
];

export function completionKindName(kind: number | undefined): CompletionKindName {
  return (kind !== undefined && LSP_KINDS[kind - 1]) || "Text";
}

export function toMonacoPosition({ line, character }: Position): IPosition {
  return { lineNumber: line + 1, column: character + 1 };
}

export function toLspPosition({ lineNumber, column }: IPosition): Position {
  return { line: lineNumber - 1, character: column - 1 };
}

export function toMonacoRange({ start, end }: Range): IRange {
  return { startLineNumber: start.line + 1, startColumn: start.character + 1, endLineNumber: end.line + 1, endColumn: end.character + 1 };
}

export function toLspRange(range: IRange): Range {
  return {
    start: toLspPosition({ lineNumber: range.startLineNumber, column: range.startColumn }),
    end: toLspPosition({ lineNumber: range.endLineNumber, column: range.endColumn }),
  };
}

export function toMonacoDocumentation(doc: string | MarkupContent | undefined): string | IMarkdownString | undefined {
  if (doc === undefined || typeof doc === "string") return doc;
  return doc.kind === "markdown" ? { value: doc.value } : doc.value;
}

/** A Monaco completion item, with its kind still a name for the caller to look up. */
export interface MonacoCompletion extends Omit<languages.CompletionItem, "kind"> {
  kindName: CompletionKindName;
}

/**
 * Converts an LSP completion item. `wordRange`, the word being typed, is where it goes when the
 * item has no text edit of its own.
 */
export function toMonacoCompletion(item: CompletionItem, wordRange: IRange): MonacoCompletion {
  const edit = item.textEdit;
  const range: MonacoCompletion["range"] =
    edit === undefined
      ? wordRange
      : "range" in edit
        ? toMonacoRange(edit.range)
        : { insert: toMonacoRange(edit.insert), replace: toMonacoRange(edit.replace) };
  const details = item.labelDetails;
  return {
    // Auto-imports of one name from two modules differ only in their description.
    label: details ? { label: item.label, detail: details.detail, description: details.description } : item.label,
    kindName: completionKindName(item.kind),
    insertText: edit?.newText ?? item.insertText ?? item.label,
    range,
    // An auto-import's `import` line.
    additionalTextEdits: item.additionalTextEdits?.map((e) => ({ text: e.newText, range: toMonacoRange(e.range) })),
    detail: item.detail,
    documentation: toMonacoDocumentation(item.documentation),
    sortText: item.sortText,
    filterText: item.filterText,
  };
}

export type MarkerSeverityName = keyof typeof MarkerSeverity;
export type MarkerTagName = keyof typeof MarkerTag;

/** LSP `DiagnosticSeverity` values (1-based); Monaco's numbering differs, so names bridge them. */
const LSP_SEVERITIES: MarkerSeverityName[] = ["Error", "Warning", "Info", "Hint"];
/** LSP `DiagnosticTag` values (1-based); Monaco uses the same names. */
const LSP_TAGS: MarkerTagName[] = ["Unnecessary", "Deprecated"];

/** A diagnostic without a severity is an error, as the protocol leaves it to the client. */
export function markerSeverityName(severity: number | undefined): MarkerSeverityName {
  return (severity !== undefined && LSP_SEVERITIES[severity - 1]) || "Error";
}

/** A Monaco marker, with its severity and tags still names for the caller to look up. */
export interface MonacoMarker extends Omit<editor.IMarkerData, "severity" | "tags" | "code"> {
  severityName: MarkerSeverityName;
  tagNames: MarkerTagName[];
  /** The rule that produced it, e.g. `reportUndefinedVariable`. */
  code?: string;
}

export function toMonacoMarker(diagnostic: Diagnostic): MonacoMarker {
  return {
    ...toMonacoRange(diagnostic.range),
    severityName: markerSeverityName(diagnostic.severity),
    // Markers show plain text only; LSP 3.18 also allows markup.
    message: typeof diagnostic.message === "string" ? diagnostic.message : diagnostic.message.value,
    source: diagnostic.source,
    code: diagnostic.code === undefined ? undefined : String(diagnostic.code),
    tagNames: (diagnostic.tags ?? []).flatMap((tag) => LSP_TAGS[tag - 1] ?? []),
  };
}

/** Backslash-escapes markdown's special characters, so plain text shows as written. */
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, "\\$&");
}

/**
 * Hover contents as Monaco markdown. A `MarkupContent` is markdown or plain text; a
 * `MarkedString` is markdown, or a code block when it names a language. Empty parts are dropped.
 */
export function toMonacoHoverContents(contents: Hover["contents"]): IMarkdownString[] {
  const parts: (MarkupContent | MarkedString)[] = Array.isArray(contents) ? contents : [contents];
  return parts.flatMap((part) => {
    const value =
      typeof part === "string"
        ? part
        : "kind" in part
          ? part.kind === "markdown"
            ? part.value
            : escapeMarkdown(part.value)
          : "```" + part.language + "\n" + part.value + "\n```";
    return value ? [{ value }] : [];
  });
}

/** Undefined when there is nothing to show. */
export function toMonacoHover(hover: Hover): languages.Hover | undefined {
  const contents = toMonacoHoverContents(hover.contents);
  if (contents.length === 0) return undefined;
  return { contents, ...(hover.range && { range: toMonacoRange(hover.range) }) };
}

/**
 * Parameter labels stay as given: a substring of the signature's label, or its offsets in it.
 * A signature's own active parameter overrides the top-level one, which pyright sets differently;
 * the active signature's is copied to the top level too, for a reader that looks only there.
 */
export function toMonacoSignatureHelp(help: SignatureHelp): languages.SignatureHelp {
  const activeSignature = help.activeSignature ?? 0;
  const ownActive = help.signatures[activeSignature]?.activeParameter;
  return {
    signatures: help.signatures.map((signature) => ({
      label: signature.label,
      documentation: toMonacoDocumentation(signature.documentation),
      parameters: (signature.parameters ?? []).map((parameter) => ({
        label: parameter.label,
        documentation: toMonacoDocumentation(parameter.documentation),
      })),
      ...(typeof signature.activeParameter === "number" && { activeParameter: signature.activeParameter }),
    })),
    activeSignature,
    activeParameter: typeof ownActive === "number" ? ownActive : (help.activeParameter ?? 0),
  };
}

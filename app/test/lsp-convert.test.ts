import { expect, test } from "bun:test";
import {
  completionKindName,
  markerSeverityName,
  toLspPosition,
  toLspRange,
  toMonacoCompletion,
  toMonacoMarker,
  toMonacoPosition,
  toMonacoRange,
} from "../src/renderer/src/lsp/convert";

test("LSP positions are 0-based, Monaco's 1-based", () => {
  expect(toMonacoPosition({ line: 0, character: 0 })).toEqual({ lineNumber: 1, column: 1 });
  expect(toLspPosition({ lineNumber: 3, column: 8 })).toEqual({ line: 2, character: 7 });
});

test("positions and ranges round-trip", () => {
  const position = { line: 4, character: 11 };
  expect(toLspPosition(toMonacoPosition(position))).toEqual(position);
  const range = { start: { line: 1, character: 4 }, end: { line: 2, character: 0 } };
  expect(toMonacoRange(range)).toEqual({ startLineNumber: 2, startColumn: 5, endLineNumber: 3, endColumn: 1 });
  expect(toLspRange(toMonacoRange(range))).toEqual(range);
});

test("completion kinds map by name, unknown ones to Text", () => {
  expect(completionKindName(2)).toBe("Method");
  expect(completionKindName(3)).toBe("Function");
  expect(completionKindName(6)).toBe("Variable");
  expect(completionKindName(7)).toBe("Class");
  expect(completionKindName(9)).toBe("Module");
  expect(completionKindName(14)).toBe("Keyword");
  expect(completionKindName(21)).toBe("Constant");
  expect(completionKindName(undefined)).toBe("Text");
  expect(completionKindName(99)).toBe("Text");
});

const wordRange = { startLineNumber: 2, startColumn: 5, endLineNumber: 2, endColumn: 8 };

test("an item without a text edit inserts insertText, else its label, over the word being typed", () => {
  expect(toMonacoCompletion({ label: "stdout", kind: 6 }, wordRange)).toMatchObject({
    label: "stdout",
    kindName: "Variable",
    insertText: "stdout",
    range: wordRange,
  });
  expect(toMonacoCompletion({ label: "sqrt", insertText: "sqrt" }, wordRange).insertText).toBe("sqrt");
});

test("a text edit sets both the inserted text and the range", () => {
  const item = toMonacoCompletion(
    {
      label: "stdin",
      textEdit: { newText: "stdin", range: { start: { line: 1, character: 4 }, end: { line: 1, character: 7 } } },
    },
    { startLineNumber: 9, startColumn: 9, endLineNumber: 9, endColumn: 9 },
  );
  expect(item.insertText).toBe("stdin");
  expect(item.range).toEqual({ startLineNumber: 2, startColumn: 5, endLineNumber: 2, endColumn: 8 });
});

test("an insert/replace edit becomes Monaco's insert and replace ranges", () => {
  const item = toMonacoCompletion(
    {
      label: "path",
      textEdit: {
        newText: "path",
        insert: { start: { line: 0, character: 3 }, end: { line: 0, character: 5 } },
        replace: { start: { line: 0, character: 3 }, end: { line: 0, character: 7 } },
      },
    },
    wordRange,
  );
  expect(item.range).toEqual({
    insert: { startLineNumber: 1, startColumn: 4, endLineNumber: 1, endColumn: 6 },
    replace: { startLineNumber: 1, startColumn: 4, endLineNumber: 1, endColumn: 8 },
  });
});

test("markdown documentation passes through, plain text stays a string", () => {
  const md = toMonacoCompletion({ label: "a", documentation: { kind: "markdown", value: "**x**" } }, wordRange);
  expect(md.documentation).toEqual({ value: "**x**" });
  const plain = toMonacoCompletion({ label: "a", documentation: { kind: "plaintext", value: "x" } }, wordRange);
  expect(plain.documentation).toBe("x");
  expect(toMonacoCompletion({ label: "a", documentation: "y" }, wordRange).documentation).toBe("y");
});

test("detail, sort and filter text are kept", () => {
  expect(
    toMonacoCompletion({ label: "a", detail: "int", sortText: "09", filterText: "aa" }, wordRange),
  ).toMatchObject({ detail: "int", sortText: "09", filterText: "aa" });
});

test("an auto-import keeps its import edit and shows the module it comes from", () => {
  const item = toMonacoCompletion(
    {
      label: "StrEnum",
      labelDetails: { description: "enum" },
      additionalTextEdits: [
        { newText: "from enum import StrEnum\n", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } },
      ],
    },
    wordRange,
  );
  expect(item.label).toEqual({ label: "StrEnum", description: "enum" });
  expect(item.additionalTextEdits).toEqual([
    { text: "from enum import StrEnum\n", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } },
  ]);
});

test("an item without label details keeps a plain label", () => {
  expect(toMonacoCompletion({ label: "x" }, wordRange).label).toBe("x");
});

test("diagnostic severities map to marker severities, a missing one to Error", () => {
  expect(markerSeverityName(1)).toBe("Error");
  expect(markerSeverityName(2)).toBe("Warning");
  expect(markerSeverityName(3)).toBe("Info");
  expect(markerSeverityName(4)).toBe("Hint");
  expect(markerSeverityName(undefined)).toBe("Error");
});

test("a diagnostic becomes a marker over the same range, keeping its message, rule and tags", () => {
  const marker = toMonacoMarker({
    range: { start: { line: 0, character: 6 }, end: { line: 0, character: 20 } },
    severity: 1,
    message: '"undefined_name" is not defined',
    source: "Pyright",
    code: "reportUndefinedVariable",
    tags: [1],
  });
  expect(marker).toEqual({
    startLineNumber: 1,
    startColumn: 7,
    endLineNumber: 1,
    endColumn: 21,
    severityName: "Error",
    message: '"undefined_name" is not defined',
    source: "Pyright",
    code: "reportUndefinedVariable",
    tagNames: ["Unnecessary"],
  });
});

test("unknown diagnostic tags are dropped", () => {
  const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } };
  expect(toMonacoMarker({ range, message: "m", tags: [2, 7 as 1] }).tagNames).toEqual(["Deprecated"]);
  expect(toMonacoMarker({ range, message: "m" }).tagNames).toEqual([]);
});

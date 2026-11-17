import { describe, expect, test } from "bun:test";
import { pythonCompletions, type CompletionKind } from "../src/renderer/src/completion";

const labelsOf = (kind: CompletionKind, text = "", word = "") =>
  pythonCompletions(text, word)
    .filter((c) => c.kind === kind)
    .map((c) => c.label);

describe("python completions", () => {
  test("offers keywords and builtins, so `pri` can complete to `print`", () => {
    expect(labelsOf("keyword")).toEqual(expect.arrayContaining(["def", "return", "while", "lambda", "None", "True"]));
    expect(labelsOf("builtin")).toEqual(expect.arrayContaining(["print", "input", "len", "sorted", "enumerate"]));
    expect(labelsOf("builtin").filter((l) => l.startsWith("pri"))).toEqual(["print"]);
  });

  test("offers snippets for the main guard and for reading stdin", () => {
    const snippets = pythonCompletions("").filter((c) => c.kind === "snippet");
    const main = snippets.find((s) => s.label === "ifmain");
    expect(main?.insertText).toStartWith('if __name__ == "__main__":\n    ');
    const stdin = snippets.filter((s) => s.insertText.includes("sys.stdin"));
    expect(stdin.length).toBeGreaterThanOrEqual(2);
    expect(stdin.every((s) => s.insertText.startsWith("import sys\n"))).toBe(true);
    // Every snippet says what it does, since its label alone is terse.
    expect(snippets.every((s) => s.detail)).toBe(true);
  });

  test("offers identifiers already in the file, once each, without repeating keywords or builtins", () => {
    const text = "def parse_header(raw):\n    tokens = raw.split(',')\n    return tokens\n\nprint(parse_header(x_1))\n";
    expect(labelsOf("identifier", text).sort()).toEqual(["parse_header", "raw", "split", "tokens", "x_1"]);
  });

  test("the half-typed word under the cursor is not offered back as its own completion", () => {
    expect(labelsOf("identifier", "total = 0\ntot", "tot")).toEqual(["total"]);
    // ...unless it also appears elsewhere in the file.
    expect(labelsOf("identifier", "tot = 0\ntot", "tot")).toEqual(["tot"]);
  });
});

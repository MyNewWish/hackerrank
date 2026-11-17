import { describe, expect, test } from "bun:test";
import { diffOutput, finalNewlineNote } from "../src/renderer/src/diff";

describe("output diff", () => {
  test("identical output is all unchanged lines", () => {
    expect(diffOutput("1\n2\n", "1\n2\n")).toEqual([
      { kind: "same", text: "1" },
      { kind: "same", text: "2" },
    ]);
  });

  test("a missing line shows as removed and an extra line as added, around the matching lines", () => {
    expect(diffOutput("a\nb\nc\n", "a\nc\nd\n")).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "same", text: "c" },
      { kind: "added", text: "d" },
    ]);
  });

  test("a changed line pinpoints the differing characters, so wrong spacing stands out", () => {
    expect(diffOutput("total: 3\nok\n", "total:  3 \nok\n")).toEqual([
      { kind: "removed", text: "total: 3", segments: [{ text: "total: 3", changed: false }] },
      {
        kind: "added",
        text: "total:  3 ",
        segments: [
          { text: "total: ", changed: false },
          { text: " ", changed: true },
          { text: "3", changed: false },
          { text: " ", changed: true },
        ],
      },
      { kind: "same", text: "ok" },
    ]);
  });

  test("a missing or extra final newline is reported, since it is invisible in the line diff", () => {
    expect(finalNewlineNote("a\n", "a")).toBe("Expected output ends with a newline; yours does not.");
    expect(finalNewlineNote("a", "a\n")).toBe("Your output ends with a newline; the expected output does not.");
    expect(finalNewlineNote("a\n", "b\n")).toBeUndefined();
    expect(finalNewlineNote("", "")).toBeUndefined();
  });

  test("changed lines in a block are paired in order; unpaired leftovers get no segments", () => {
    const lines = diffOutput("x 1\ny 2\n", "x 9\ny 8\nz\n");
    expect(lines.map((l) => [l.kind, l.text, "segments" in l])).toEqual([
      ["removed", "x 1", true],
      ["removed", "y 2", true],
      ["added", "x 9", true],
      ["added", "y 8", true],
      ["added", "z", false],
    ]);
  });
});

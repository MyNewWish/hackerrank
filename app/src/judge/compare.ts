import type { CompareMode } from "./types";

/** Whether `actual` program output matches `expected` under `mode`. */
export function outputsMatch(expected: string, actual: string, mode: CompareMode): boolean {
  switch (mode) {
    case "lines":
      return linesEqual(expected, actual);
  }
}

/** Line by line, ignoring trailing whitespace on each line and trailing empty lines. */
function linesEqual(expected: string, actual: string): boolean {
  const a = normalizeLines(expected);
  const b = normalizeLines(actual);
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

function normalizeLines(text: string): string[] {
  const lines = text.split("\n").map((line) => line.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

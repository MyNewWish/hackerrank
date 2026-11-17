import type { CompareMode } from "./types";

/** Human-readable list of accepted `compare` values, for validation messages. */
export const COMPARE_MODE_HELP = "lines, exact, float:<eps> (eps a non-negative number, e.g. float:1e-6)";

const FLOAT_PREFIX = "float:";
/** A plain decimal number: no hex, no Infinity/NaN, no empty string (all of which `Number()` accepts). */
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** Whether `value` is a valid `compare` setting from question.yaml. */
export function isCompareMode(value: unknown): value is CompareMode {
  if (value === "lines" || value === "exact") return true;
  return typeof value === "string" && value.startsWith(FLOAT_PREFIX) && floatEps(value as CompareMode) !== undefined;
}

/** Whether `actual` program output matches `expected` under `mode`. */
export function outputsMatch(expected: string, actual: string, mode: CompareMode): boolean {
  switch (mode) {
    case "lines":
      return linesEqual(expected, actual);
    case "exact":
      return toLf(expected) === toLf(actual);
    default: {
      const eps = floatEps(mode);
      if (eps === undefined) throw new Error(`unknown compare mode "${mode}"`);
      return tokensWithin(expected, actual, eps);
    }
  }
}

/** The eps of a `float:<eps>` mode, or undefined if it is not a non-negative decimal number. */
function floatEps(mode: CompareMode): number | undefined {
  const text = mode.slice(FLOAT_PREFIX.length);
  if (!DECIMAL.test(text)) return undefined;
  const eps = Number(text);
  return eps >= 0 ? eps : undefined;
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

function toLf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/** Whitespace-separated tokens: numerically within eps when both are numbers, else equal as strings. */
function tokensWithin(expected: string, actual: string, eps: number): boolean {
  const a = tokens(expected);
  const b = tokens(actual);
  return a.length === b.length && a.every((token, i) => tokenMatches(token, b[i]!, eps));
}

function tokens(text: string): string[] {
  return text.split(/\s+/).filter((t) => t !== "");
}

function tokenMatches(expected: string, actual: string, eps: number): boolean {
  if (DECIMAL.test(expected) && DECIMAL.test(actual)) {
    return Math.abs(Number(expected) - Number(actual)) <= eps;
  }
  return expected === actual;
}

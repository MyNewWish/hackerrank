import { describe, expect, test } from "bun:test";
import { outputsMatch } from "../src/judge";

describe("outputsMatch exact", () => {
  test("treats CRLF and LF as the same line ending", () => {
    expect(outputsMatch("1\r\n2\r\n", "1\n2\n", "exact")).toBe(true);
  });

  test("fails on a missing final newline or a trailing blank line", () => {
    expect(outputsMatch("1\n2\n", "1\n2", "exact")).toBe(false);
    expect(outputsMatch("1\n2\n", "1\n2\n\n", "exact")).toBe(false);
  });
});

describe("outputsMatch float:<eps>", () => {
  test("passes numbers within eps, including the boundary", () => {
    expect(outputsMatch("0.5 2\n", "0.5001 1.9999\n", "float:1e-3")).toBe(true);
    expect(outputsMatch("1.0\n", "1.5\n", "float:0.5")).toBe(true);
  });

  test("fails a number further than eps away", () => {
    expect(outputsMatch("1.0\n", "1.002\n", "float:1e-3")).toBe(false);
  });

  test("compares non-numeric tokens as exact strings", () => {
    expect(outputsMatch("total 3.0 USD\n", "total 3.0000001 USD\n", "float:1e-6")).toBe(true);
    expect(outputsMatch("total 3.0 USD\n", "total 3.0 usd\n", "float:1e-6")).toBe(false);
    // a number where a word is expected is a string mismatch, not a numeric one
    expect(outputsMatch("n/a\n", "0\n", "float:100")).toBe(false);
  });

  test("does not treat hex, Infinity or NaN as numbers", () => {
    expect(outputsMatch("16\n", "0x10\n", "float:0.1")).toBe(false);
    expect(outputsMatch("Infinity\n", "1e400\n", "float:0.1")).toBe(false);
  });

  test("fails when the token counts differ", () => {
    expect(outputsMatch("1 2\n", "1\n", "float:1")).toBe(false);
    expect(outputsMatch("1\n", "1 2\n", "float:1")).toBe(false);
  });

  test("ignores how tokens are spread across whitespace", () => {
    expect(outputsMatch("1 2\n3\n", "1\n2  3\n\n", "float:0")).toBe(true);
  });
});

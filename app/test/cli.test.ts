import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { makeTree, SUM_REFERENCE, sumQuestionFiles } from "./helpers";

const CLI = join(import.meta.dir, "..", "src", "cli");
/** A bank holding q1_sum (valid, with reference.py) plus `extra` files. */
function bank(extra: Record<string, string> = {}): string {
  return makeTree({ ...sumQuestionFiles("q1_sum/"), "q1_sum/reference.py": SUM_REFERENCE, ...extra });
}

function cli(script: string, ...args: string[]) {
  const proc = Bun.spawnSync(["bun", join(CLI, script), ...args]);
  return { code: proc.exitCode, out: proc.stdout.toString() + proc.stderr.toString() };
}

describe("gen CLI", () => {
  test("writes missing outputs for the question id and exits 0", () => {
    const dir = bank();
    rmSync(join(dir, "q1_sum/tests/part1/hidden/01.out"));

    const { code, out } = cli("gen.ts", "q1", "--bank", dir);

    expect(code).toBe(0);
    expect(out).toContain("tests/part1/hidden/01.out");
    expect(readFileSync(join(dir, "q1_sum/tests/part1/hidden/01.out"), "utf8")).toBe("30\n");
  });

  test("exits non-zero for an unknown question id", () => {
    const { code, out } = cli("gen.ts", "q9", "--bank", bank());

    expect(code).not.toBe(0);
    expect(out).toContain('no question "q9"');
  });
});

describe("validate CLI", () => {
  test("exits 0 when every question is valid", () => {
    const { code, out } = cli("validate.ts", "--bank", bank());

    expect(code).toBe(0);
    expect(out).toContain("q1_sum");
    expect(out).toContain("OK");
  });

  test("exits non-zero and names each problem in a broken bank", () => {
    const dir = bank({
      ...sumQuestionFiles("q2_broken/"),
      "q2_broken/reference.py": "print('nope')\n",
      "q2_broken/tests/part9/sample/01.in": "1 1\n",
      "q2_broken/tests/part9/sample/01.out": "2\n",
    });
    rmSync(join(dir, "q2_broken/tests/part1/hidden/01.out"));

    const { code, out } = cli("validate.ts", "--bank", dir);

    expect(code).not.toBe(0);
    expect(out).toContain("q1_sum: OK");
    expect(out).toContain("tests/part9");
    expect(out).toContain("tests/part1/hidden/01.in: has no matching .out file");
  });

  test("validates a single question by id, reporting tests the reference fails", () => {
    const dir = bank({ "q1_sum/tests/part2/hidden/01.out": "999\n" });

    const { code, out } = cli("validate.ts", "q1", "--bank", dir);

    expect(code).not.toBe(0);
    expect(out).toContain("tests/part2/hidden/01.in: reference output differs");
  });
});

test("validate rejects --force, which only gen accepts", () => {
  const { code, out } = cli("validate.ts", "--force", "--bank", bank());

  expect(code).toBe(2);
  expect(out).toContain("usage: validate");
});

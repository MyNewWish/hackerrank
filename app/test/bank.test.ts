import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { scanBank } from "../src/judge";
import { makeTree, sumQuestionFiles } from "./helpers";

describe("scanBank", () => {
  test("lists question folders sorted by numeric id and ignores other folders", () => {
    const bank = makeTree({
      ...sumQuestionFiles("q10_ten/"),
      ...sumQuestionFiles("q2_two/"),
      ...sumQuestionFiles("q1_one/"),
      "notes/readme.txt": "not a question",
      "q3_file.txt": "a file, not a folder",
    });

    const entries = scanBank(bank);

    expect(entries.map((e) => e.folder)).toEqual(["q1_one", "q2_two", "q10_ten"]);
    expect(entries.map((e) => e.id)).toEqual(["q1", "q2", "q10"]);
    expect(entries.every((e) => e.ok)).toBe(true);
  });

  test("surfaces a malformed folder as an errored entry without failing the scan", () => {
    const bank = makeTree({
      ...sumQuestionFiles("q1_good/"),
      "q2_broken/question.yaml": "::: not yaml [",
      ...sumQuestionFiles("q3_good/"),
    });

    const entries = scanBank(bank);

    expect(entries.map((e) => [e.id, e.ok])).toEqual([
      ["q1", true],
      ["q2", false],
      ["q3", true],
    ]);
    const broken = entries[1]!;
    if (broken.ok) throw new Error("expected q2 to fail");
    expect(broken.errors.length).toBeGreaterThan(0);
  });

  test("a folder whose files cannot be read is an errored entry, not a failed scan", () => {
    const bank = makeTree({
      ...sumQuestionFiles("q1_good/"),
      ...sumQuestionFiles("q2_unreadable/"),
      // problem.md is a directory, so reading it as a file fails at the OS level
      "q2_unreadable/problem.md": "",
    });
    rmSync(join(bank, "q2_unreadable", "problem.md"));
    mkdirSync(join(bank, "q2_unreadable", "problem.md"));

    const entries = scanBank(bank);

    expect(entries.map((e) => [e.id, e.ok])).toEqual([
      ["q1", true],
      ["q2", false],
    ]);
    const broken = entries[1]!;
    if (broken.ok) throw new Error("expected q2 to fail");
    expect(broken.errors).toEqual([{ path: "problem.md", message: expect.any(String) }]);
  });
});

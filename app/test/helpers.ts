import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Creates a fresh temp directory and writes `files` (relative path → content) into it. */
export function makeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "judge-test-"));
  writeTree(root, files);
  return root;
}

export function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

export const SUM_YAML = `title: Sum two numbers
difficulty: easy
tags: [math, io]
targetMinutes: 10
parts:
  - { id: part1, title: One pair }
  - { id: part2, title: Many pairs }
`;

/**
 * A "sum two numbers" question with two parts.
 * part1: one line "a b" → a+b. part2: several "a b" lines → one sum per line.
 */
export function sumQuestionFiles(prefix = ""): Record<string, string> {
  return {
    [`${prefix}question.yaml`]: SUM_YAML,
    [`${prefix}problem.md`]: "# Sum\n\n## Part 1\n\nAdd.\n\n## Part 2\n\nAdd many.\n",
    [`${prefix}tests/part1/sample/01.in`]: "1 2\n",
    [`${prefix}tests/part1/sample/01.out`]: "3\n",
    [`${prefix}tests/part1/hidden/01.in`]: "10 20\n",
    [`${prefix}tests/part1/hidden/01.out`]: "30\n",
    [`${prefix}tests/part1/hidden/02.in`]: "-5 5\n",
    [`${prefix}tests/part1/hidden/02.out`]: "0\n",
    [`${prefix}tests/part2/sample/01.in`]: "1 1\n2 2\n",
    [`${prefix}tests/part2/sample/01.out`]: "2\n4\n",
    [`${prefix}tests/part2/hidden/01.in`]: "100 1\n7 8\n0 0\n",
    [`${prefix}tests/part2/hidden/01.out`]: "101\n15\n0\n",
  };
}

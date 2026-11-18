import { describe, expect, test } from "bun:test";
import { statementPreview } from "../src/renderer/src/statement-preview";

const lines = (...ls: string[]) => ls.join("\n");

describe("statement preview", () => {
  test("the intro is everything before the first ## heading", () => {
    const md = lines("# Ledger", "", "Track balances.", "", "## Input Format", "", "One line per transaction.");

    expect(statementPreview(md).intro).toBe(lines("# Ledger", "", "Track balances."));
  });

  test("a ## line inside a fenced code block is not a heading", () => {
    const intro = lines("Read markdown like:", "", "```", "## not a heading", "```", "", "~~~~", "## nor this", "~~~~");
    const md = lines(intro, "", "## Input Format", "Lines.");

    expect(statementPreview(md).intro).toBe(intro);
  });

  test("a fence closes only on a bare run of its own character at least as long as the opener", () => {
    const intro = lines("````md", "```python", "## a", "~~~~", "```", "## b", "````");
    const md = lines(intro, "## Input Format");

    expect(statementPreview(md).intro).toBe(intro);
  });

  test("the part titles are the ## Part N headings outside code, in order, without the other headings", () => {
    const md = lines(
      "Intro.",
      "## Input Format",
      "## Output Format",
      "## Part 1 — Balances",
      "Body one.",
      "```",
      "## Part 9 — In code",
      "```",
      "##   Part 2 — Dispute rate  ",
      "## Notes",
      "## Part 3 — Real-world messiness",
    );

    expect(statementPreview(md).partTitles).toEqual([
      "Part 1 — Balances",
      "Part 2 — Dispute rate",
      "Part 3 — Real-world messiness",
    ]);
  });

  test("a statement with no ## heading falls back to its first 15 lines", () => {
    const all = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}.`);

    expect(statementPreview(all.join("\n")).intro).toBe(all.slice(0, 15).join("\n"));
    expect(statementPreview(all.slice(0, 4).join("\n")).intro).toBe(all.slice(0, 4).join("\n"));
  });

  test("the fallback is cut before a fenced code block that runs past line 15", () => {
    const prose = Array.from({ length: 12 }, (_, i) => `Line ${i + 1}.`);
    const md = lines(...prose, "", "```", "a", "b", "c", "d", "```", "After.");

    expect(statementPreview(md).intro).toBe(prose.join("\n"));
  });

  test("a ## heading only inside an unclosed fence is no heading, so the fallback applies", () => {
    const md = lines("Intro.", "```", ...Array.from({ length: 20 }, () => "## code"));

    expect(statementPreview(md).intro).toBe("Intro.");
  });

  test("a statement with no ## Part N heading has no part titles", () => {
    expect(statementPreview(lines("Intro.", "## Input Format", "x")).partTitles).toEqual([]);
  });
});

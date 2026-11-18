/**
 * What Home shows of a problem statement before testing starts: enough to get the gist and shape
 * of a question, not enough to start solving it.
 */
export interface StatementPreview {
  /** The statement's markdown before its first `## ` heading. */
  intro: string;
  /** The titles of its `## Part N` headings, in order, such as "Part 1 — Balances". */
  partTitles: string[];
}

/** How many lines the intro falls back to when the statement has no `## ` heading. */
const FALLBACK_LINES = 15;

/** A heading that names a part, such as "Part 3 — Real-world messiness"; group 1 is its number. */
export const PART_HEADING = /^Part (\d+)\b/;

/**
 * The preview of statement `markdown`. Headings inside fenced code blocks do not count. With no
 * `## ` heading, the intro is the first `FALLBACK_LINES` lines, cut back to before any fenced code
 * block still open there.
 */
export function statementPreview(markdown: string): StatementPreview {
  const lines = markdown.split(/\r?\n/);
  const { headings, openFenceAfter } = scanHeadingsOutsideFences(lines);
  const partTitles = headings.map((i) => lines[i]!.slice(3).trim()).filter((t) => PART_HEADING.test(t));
  let end = headings[0];
  if (end === undefined) {
    end = Math.min(FALLBACK_LINES, lines.length);
    end = openFenceAfter[end - 1] ?? end;
  }
  return { intro: lines.slice(0, end).join("\n").trimEnd(), partTitles };
}

/**
 * The indexes of `## ` heading lines outside fenced code blocks, and for each line the index of
 * the fenced code block's opening line if one is still open after it.
 */
function scanHeadingsOutsideFences(lines: string[]): { headings: number[]; openFenceAfter: (number | undefined)[] } {
  const headings: number[] = [];
  const openFenceAfter: (number | undefined)[] = [];
  let fence: { marker: string; start: number } | undefined;
  lines.forEach((line, i) => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence !== undefined) {
      // A closing fence has the opener's character, at least as many of them, and nothing after.
      const closes =
        marker !== undefined &&
        marker[0] === fence.marker[0] &&
        marker.length >= fence.marker.length &&
        line.trim() === marker;
      if (closes) fence = undefined;
    } else if (marker !== undefined) {
      fence = { marker, start: i };
    } else if (line.startsWith("## ")) {
      headings.push(i);
    }
    openFenceAfter.push(fence?.start);
  });
  return { headings, openFenceAfter };
}

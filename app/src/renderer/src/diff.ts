/** A run of characters in a changed line; `changed` ones are what differs from its paired line. */
export interface Segment {
  text: string;
  changed: boolean;
}

/** One line of the diff: in both outputs, only the expected one (removed), or only yours (added). */
export type DiffLine =
  | { kind: "same"; text: string }
  /** `segments` is set when the line is paired with a line on the other side. */
  | { kind: "removed" | "added"; text: string; segments?: Segment[] };

/**
 * A line-by-line diff of a test's expected output (removed) against the actual output (added).
 * Within each block of changes, removed lines come first, and the k-th removed line is paired
 * with the k-th added line and diffed character by character.
 */
export function diffOutput(expected: string, actual: string): DiffLine[] {
  const ops = diffSequences(splitLines(expected), splitLines(actual));
  const lines: DiffLine[] = [];
  let removed: string[] = [];
  let added: string[] = [];
  const flush = () => {
    const pairs = Math.min(removed.length, added.length);
    const segments = removed.slice(0, pairs).map((r, k) => charSegments(r, added[k]!));
    lines.push(
      ...removed.map((text, k): DiffLine => ({ kind: "removed", text, ...(k < pairs && { segments: segments[k]!.removed }) })),
      ...added.map((text, k): DiffLine => ({ kind: "added", text, ...(k < pairs && { segments: segments[k]!.added }) })),
    );
    removed = [];
    added = [];
  };
  for (const [kind, text] of ops) {
    if (kind === "removed") removed.push(text);
    else if (kind === "added") added.push(text);
    else {
      flush();
      lines.push({ kind, text });
    }
  }
  flush();
  return lines;
}

/**
 * Says which side has a final newline when only one does: the line diff cannot show it, yet an
 * `exact` comparison fails on it.
 */
export function finalNewlineNote(expected: string, actual: string): string | undefined {
  const expectedEnds = expected.endsWith("\n");
  const actualEnds = actual.endsWith("\n");
  if (expectedEnds === actualEnds || expected === "" || actual === "") return undefined;
  return expectedEnds
    ? "Expected output ends with a newline; yours does not."
    : "Your output ends with a newline; the expected output does not.";
}

/** The two lines split into unchanged and changed runs of characters. */
function charSegments(removedLine: string, addedLine: string): { removed: Segment[]; added: Segment[] } {
  const ops = diffSequences(Array.from(removedLine), Array.from(addedLine));
  const side = (other: "removed" | "added") => {
    const segments: Segment[] = [];
    for (const [kind, ch] of ops) {
      if (kind === other) continue;
      const changed = kind !== "same";
      const last = segments.at(-1);
      if (last && last.changed === changed) last.text += ch;
      else segments.push({ text: ch, changed });
    }
    return segments;
  };
  return { removed: side("added"), added: side("removed") };
}

function splitLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

type Op<T> = ["same" | "removed" | "added", T];

/** Beyond this many LCS cells, the differing middle is shown as all-removed then all-added. */
const MAX_LCS_CELLS = 4_000_000;

/** A shortest edit script from `a` to `b` (longest common subsequence), removals before additions. */
function diffSequences<T>(a: T[], b: T[]): Op<T>[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const same = (xs: T[]): Op<T>[] => xs.map((x) => ["same", x]);
  return [
    ...same(a.slice(0, start)),
    ...diffMiddle(a.slice(start, endA), b.slice(start, endB)),
    ...same(a.slice(endA)),
  ];
}

function diffMiddle<T>(a: T[], b: T[]): Op<T>[] {
  const removed = a.map((x): Op<T> => ["removed", x]);
  const added = b.map((x): Op<T> => ["added", x]);
  if (a.length === 0 || b.length === 0 || a.length * b.length > MAX_LCS_CELLS) return [...removed, ...added];

  // lcs[i][j] = length of the LCS of a[i..] and b[j..].
  const width = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1]! + 1
          : Math.max(lcs[(i + 1) * width + j]!, lcs[i * width + j + 1]!);
    }
  }
  const ops: Op<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push(["same", a[i]!]);
      i++;
      j++;
    } else if (lcs[(i + 1) * width + j]! >= lcs[i * width + j + 1]!) {
      ops.push(["removed", a[i++]!]);
    } else {
      ops.push(["added", b[j++]!]);
    }
  }
  return [...ops, ...removed.slice(i), ...added.slice(j)];
}

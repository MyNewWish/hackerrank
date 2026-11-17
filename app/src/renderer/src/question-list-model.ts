import type { Difficulty, QuestionSummary } from "../../shared/api";

/** What Home narrows the bank to: a search query, tags that must all be present, and a difficulty. */
export interface QuestionFilter {
  /** Searched in each question's id, title and tags, trimmed and ignoring case. */
  query: string;
  /** Tags a question must all have. */
  tags: string[];
  /** The only difficulty shown; none shows every difficulty. */
  difficulty?: Difficulty;
}

/** Shows every question. */
export const NO_FILTER: QuestionFilter = { query: "", tags: [] };

/** The bank as Home lists it under a filter. */
export interface QuestionListView {
  /** The questions that match, in bank order. */
  visible: QuestionSummary[];
  /** How many questions the bank has, matching or not. */
  total: number;
  /** Every tag in the bank, sorted, each once. */
  tags: string[];
  /** The selected question if it is visible; one filtered out is no longer selected. */
  selectedId: string | undefined;
}

/**
 * The questions of `questions` that match `filter`. The trimmed, case-insensitive query matches a
 * question's id, title or any tag; it must have every selected tag and the selected difficulty. A
 * malformed question has neither, so it matches the query (by id or folder) only while no tag or
 * difficulty is selected.
 */
export function questionList(
  questions: QuestionSummary[],
  filter: QuestionFilter,
  selectedId: string | undefined,
): QuestionListView {
  const query = filter.query.trim().toLowerCase();
  const visible = questions.filter((q) => matches(q, query, filter));
  const tags = [...new Set(questions.flatMap((q) => (q.ok ? q.tags : [])))].sort();
  const selected = visible.some((q) => q.id === selectedId) ? selectedId : undefined;
  return { visible, total: questions.length, tags, selectedId: selected };
}

/** Whether `filter` narrows the list at all. */
export function isFiltering(filter: QuestionFilter): boolean {
  return filter.query.trim() !== "" || filter.tags.length > 0 || filter.difficulty !== undefined;
}

function matches(q: QuestionSummary, query: string, filter: QuestionFilter): boolean {
  if (q.ok) {
    if (filter.difficulty !== undefined && q.difficulty !== filter.difficulty) return false;
    if (!filter.tags.every((t) => q.tags.includes(t))) return false;
  } else if (filter.tags.length > 0 || filter.difficulty !== undefined) {
    return false;
  }
  return searchText(q).some((s) => s.toLowerCase().includes(query));
}

/** The strings the query is searched in. */
function searchText(q: QuestionSummary): string[] {
  return q.ok ? [q.id, q.title, ...q.tags] : [q.id, q.folder];
}

/**
 * The question selected after moving `delta` rows (−1 = up, +1 = down) from `selected` through the
 * visible questions. Stops at either end; with nothing selected, picks the first.
 */
export function moveSelection(view: QuestionListView, selected: string | undefined, delta: number): string | undefined {
  const ids = view.visible.map((q) => q.id);
  const index = selected === undefined ? -1 : ids.indexOf(selected);
  if (index === -1) return ids[0];
  return ids[Math.min(ids.length - 1, Math.max(0, index + delta))];
}

/** A well-formed question, the only kind test mode opens. */
export type OkSummary = Extract<QuestionSummary, { ok: true }>;

/** What a key pressed on Home does: select another question, or start testing one. */
export type HomeKeyAction = { kind: "select"; id: string } | { kind: "start"; summary: OkSummary };

/**
 * What pressing `key` on Home does to `view`, if anything: up/down move the selection through the
 * visible questions (see `moveSelection`), and Enter starts the selected question unless it is
 * malformed.
 */
export function homeKeyAction(view: QuestionListView, key: string): HomeKeyAction | undefined {
  if (key === "ArrowDown" || key === "ArrowUp") {
    const id = moveSelection(view, view.selectedId, key === "ArrowDown" ? 1 : -1);
    return id === undefined ? undefined : { kind: "select", id };
  }
  const selected = view.visible.find((q) => q.id === view.selectedId);
  if (key === "Enter" && selected?.ok) return { kind: "start", summary: selected };
  return undefined;
}

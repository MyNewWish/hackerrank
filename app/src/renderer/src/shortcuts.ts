import type { RunMode } from "../../shared/api";

/** The parts of a keydown event the shortcuts look at. */
export type KeyPress = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/**
 * What a key press asks for: Ctrl (Cmd on macOS) + Enter submits, + ' runs the sample tests.
 * The quote key is also matched by its physical position, for layouts where it types another character.
 */
export function shortcutAction(e: KeyPress, isMac: boolean): RunMode | undefined {
  const primary = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (!primary || e.altKey || e.shiftKey) return undefined;
  if (e.key === "Enter") return "submit";
  if (e.key === "'" || e.code === "Quote") return "run";
  return undefined;
}

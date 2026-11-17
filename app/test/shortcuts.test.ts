import { describe, expect, test } from "bun:test";
import { shortcutAction, type KeyPress } from "../src/renderer/src/shortcuts";

const press = (key: string, mods: Partial<KeyPress> = {}): KeyPress => ({
  key,
  code: key === "Enter" ? "Enter" : key === "'" ? "Quote" : `Key${key.toUpperCase()}`,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("keyboard shortcuts", () => {
  test("on Windows and Linux, Ctrl+Enter submits and Ctrl+' runs", () => {
    expect(shortcutAction(press("Enter", { ctrlKey: true }), false)).toBe("submit");
    expect(shortcutAction(press("'", { ctrlKey: true }), false)).toBe("run");
  });

  test("on macOS, Cmd+Enter submits and Cmd+' runs", () => {
    expect(shortcutAction(press("Enter", { metaKey: true }), true)).toBe("submit");
    expect(shortcutAction(press("'", { metaKey: true }), true)).toBe("run");
  });

  test("the other platform's modifier, extra modifiers, or a bare key do nothing", () => {
    expect(shortcutAction(press("Enter", { metaKey: true }), false)).toBeUndefined();
    expect(shortcutAction(press("Enter", { ctrlKey: true }), true)).toBeUndefined();
    expect(shortcutAction(press("Enter", { ctrlKey: true, shiftKey: true }), false)).toBeUndefined();
    expect(shortcutAction(press("Enter"), false)).toBeUndefined();
    expect(shortcutAction(press("a", { ctrlKey: true }), false)).toBeUndefined();
  });

  test("the quote key is recognised by position on layouts where it types another character", () => {
    expect(shortcutAction({ ...press("ä", { ctrlKey: true }), code: "Quote" }, false)).toBe("run");
  });
});

import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSettingsStore } from "../src/settings";
import { makeTree } from "./helpers";

function setup() {
  const root = makeTree({ "questions/.keep": "", "other/bank/.keep": "" });
  const file = join(root, "userData", "settings.json");
  const defaultBankDir = join(root, "questions");
  return { root, file, defaultBankDir, open: () => createSettingsStore({ file, defaultBankDir }) };
}

describe("settings store", () => {
  test("starts with the default bank and auto-detected Python when nothing is saved", () => {
    const { open, defaultBankDir } = setup();

    expect(open().get()).toEqual({ bankDir: defaultBankDir, pythonPath: "", ideMode: "full" });
  });

  test("saved settings survive reopening the store (an app restart)", () => {
    const { open, root } = setup();
    const bankDir = join(root, "other", "bank");

    open().update({ bankDir, pythonPath: "/venv/bin/python", ideMode: "hackerrank" });

    expect(open().get()).toEqual({ bankDir, pythonPath: "/venv/bin/python", ideMode: "hackerrank" });
  });

  test("blank fields mean the defaults; surrounding whitespace is ignored", () => {
    const { open, defaultBankDir } = setup();

    expect(open().update({ bankDir: "  ", pythonPath: "  python3.12 ", ideMode: "full" })).toEqual({
      bankDir: defaultBankDir,
      pythonPath: "python3.12",
      ideMode: "full",
    });
  });

  test("refuses a bank folder that does not exist, keeping the previous settings", () => {
    const { open, root, defaultBankDir } = setup();
    const store = open();
    const missing = join(root, "nope");

    expect(() => store.update({ bankDir: missing, pythonPath: "", ideMode: "full" })).toThrow(missing);
    expect(store.get().bankDir).toBe(defaultBankDir);
    expect(open().get().bankDir).toBe(defaultBankDir);
  });

  test("refuses a relative bank folder, which would depend on where the app was launched from", () => {
    const { open } = setup();

    expect(() => open().update({ bankDir: "questions", pythonPath: "", ideMode: "full" })).toThrow("full path");
  });

  test("a corrupt settings file falls back to the defaults instead of crashing", () => {
    const { open, file, defaultBankDir } = setup();
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, "{ not json");

    expect(open().get()).toEqual({ bankDir: defaultBankDir, pythonPath: "", ideMode: "full" });
  });

  test("the editor mode survives reopening the store (an app restart)", () => {
    const { open } = setup();

    expect(open().setIdeMode("hackerrank").ideMode).toBe("hackerrank");

    expect(open().get().ideMode).toBe("hackerrank");
  });

  test("an unknown saved editor mode falls back to the full IDE", () => {
    const { open, file } = setup();
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, JSON.stringify({ ideMode: "vim" }));

    expect(open().get().ideMode).toBe("full");
  });

  test("switching the editor mode works even when the saved bank folder has gone", () => {
    const { open, root } = setup();
    const bankDir = join(root, "other", "bank");
    open().update({ bankDir, pythonPath: "", ideMode: "full" });
    rmSync(bankDir, { recursive: true });

    open().setIdeMode("hackerrank");

    expect(open().get()).toEqual({ bankDir, pythonPath: "", ideMode: "hackerrank" });
  });
});

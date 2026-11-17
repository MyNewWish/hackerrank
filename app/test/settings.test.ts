import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
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

    expect(open().get()).toEqual({ bankDir: defaultBankDir, pythonPath: "" });
  });

  test("saved settings survive reopening the store (an app restart)", () => {
    const { open, root } = setup();
    const bankDir = join(root, "other", "bank");

    open().update({ bankDir, pythonPath: "/venv/bin/python" });

    expect(open().get()).toEqual({ bankDir, pythonPath: "/venv/bin/python" });
  });

  test("blank fields mean the defaults; surrounding whitespace is ignored", () => {
    const { open, defaultBankDir } = setup();

    expect(open().update({ bankDir: "  ", pythonPath: "  python3.12 " })).toEqual({
      bankDir: defaultBankDir,
      pythonPath: "python3.12",
    });
  });

  test("refuses a bank folder that does not exist, keeping the previous settings", () => {
    const { open, root, defaultBankDir } = setup();
    const store = open();
    const missing = join(root, "nope");

    expect(() => store.update({ bankDir: missing, pythonPath: "" })).toThrow(missing);
    expect(store.get().bankDir).toBe(defaultBankDir);
    expect(open().get().bankDir).toBe(defaultBankDir);
  });

  test("refuses a relative bank folder, which would depend on where the app was launched from", () => {
    const { open } = setup();

    expect(() => open().update({ bankDir: "questions", pythonPath: "" })).toThrow("full path");
  });

  test("a corrupt settings file falls back to the defaults instead of crashing", () => {
    const { open, file, defaultBankDir } = setup();
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, "{ not json");

    expect(open().get()).toEqual({ bankDir: defaultBankDir, pythonPath: "" });
  });
});

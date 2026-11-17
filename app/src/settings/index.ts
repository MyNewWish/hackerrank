import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, normalize as normalizePath } from "node:path";
import type { Settings } from "../shared/api";

export interface SettingsStoreOptions {
  /** The JSON file settings persist in (in the app's user-data folder). */
  file: string;
  /** The bank used when none is configured. */
  defaultBankDir: string;
}

/**
 * The app's settings, persisted as JSON in `file` so they survive a restart. A missing or
 * unreadable file means the defaults: the default bank and auto-detected Python.
 */
export function createSettingsStore({ file, defaultBankDir }: SettingsStoreOptions) {
  /** Trims, and turns blanks into the defaults. */
  const normalize = (s: Partial<Settings>): Settings => {
    const bankDir = typeof s.bankDir === "string" ? s.bankDir.trim() : "";
    const pythonPath = typeof s.pythonPath === "string" ? s.pythonPath.trim() : "";
    return { bankDir: bankDir ? normalizePath(bankDir) : defaultBankDir, pythonPath };
  };

  let current = normalize(readSaved());

  function readSaved(): Partial<Settings> {
    try {
      const saved: unknown = JSON.parse(readFileSync(file, "utf8"));
      return typeof saved === "object" && saved !== null ? saved : {};
    } catch {
      return {};
    }
  }

  return {
    /** The current settings: the last saved, else the defaults. */
    get(): Settings {
      return current;
    },

    /** Validates, saves and returns `next` (normalized); throws, saving nothing, if it is invalid. */
    update(next: Settings): Settings {
      const settings = normalize(next);
      if (!isAbsolute(settings.bankDir)) {
        throw new Error(`Question bank folder "${settings.bankDir}" must be a full path`);
      }
      if (!isDirectory(settings.bankDir)) {
        throw new Error(`Question bank folder "${settings.bankDir}" does not exist`);
      }
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(settings, null, 2));
      current = settings;
      return current;
    },
  };
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;

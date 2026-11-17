import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, normalize as normalizePath } from "node:path";
import { IDE_MODES, type IdeMode, type Settings } from "../shared/api";

export interface SettingsStoreOptions {
  /** The JSON file settings persist in (in the app's user-data folder). */
  file: string;
  /** The bank used when none is configured. */
  defaultBankDir: string;
}

/**
 * The app's settings, persisted as JSON in `file` so they survive a restart. A missing or
 * unreadable file means the defaults: the default bank, auto-detected Python and the full IDE.
 */
export function createSettingsStore({ file, defaultBankDir }: SettingsStoreOptions) {
  /** Trims, and turns blanks and unknown editor modes into the defaults. */
  const normalize = (s: Partial<Settings>): Settings => {
    const bankDir = typeof s.bankDir === "string" ? s.bankDir.trim() : "";
    const pythonPath = typeof s.pythonPath === "string" ? s.pythonPath.trim() : "";
    const ideMode = IDE_MODES.includes(s.ideMode as IdeMode) ? (s.ideMode as IdeMode) : "full";
    return { bankDir: bankDir ? normalizePath(bankDir) : defaultBankDir, pythonPath, ideMode };
  };

  const save = (settings: Settings): Settings => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(settings, null, 2));
    current = settings;
    return current;
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
      return save(settings);
    },

    /**
     * Saves only the editor mode and returns the settings. The bank folder is not checked again,
     * so switching modes works even while it is missing.
     */
    setIdeMode(ideMode: IdeMode): Settings {
      return save(normalize({ ...current, ideMode }));
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

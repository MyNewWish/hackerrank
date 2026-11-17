import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { discoverPython, scanBank, type BankEntry, type PythonInfo, type ValidationError } from "../judge";

/** The repo's `questions/` folder (this file lives in app/src/cli). */
const DEFAULT_BANK = join(import.meta.dir, "..", "..", "..", "questions");

/** What every authoring command needs, parsed from the command line. */
export interface CliArgs {
  positionals: string[];
  /** Only ever true for commands that accept `--force`. */
  force: boolean;
  bankDir: string;
  python: PythonInfo;
}

/**
 * Parses `[ids...] [--bank <dir>] [--python <path>]` (plus `--force` when `acceptsForce`) and
 * finds Python. Exits with a message on bad arguments, a missing bank, or no Python.
 */
export async function parseCliArgs(usage: string, acceptsForce = false): Promise<CliArgs> {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        bank: { type: "string" },
        python: { type: "string" },
        ...(acceptsForce ? { force: { type: "boolean" as const, default: false } } : {}),
      },
    });
  } catch (e) {
    fail(`${(e as Error).message}\nusage: ${usage}`);
  }
  const bankDir = resolve(parsed.values.bank ?? DEFAULT_BANK);
  if (!existsSync(bankDir)) fail(`question bank not found: ${bankDir}`);
  const found = await discoverPython(parsed.values.python);
  if (!found.ok) fail(found.error);
  return { positionals: parsed.positionals, force: parsed.values.force === true, bankDir, python: found.python };
}

/** The bank entry whose id is `id`; exits if there is none. */
export function findQuestion(bankDir: string, id: string): BankEntry {
  const entry = scanBank(bankDir).find((e) => e.id === id);
  return entry ?? fail(`no question "${id}" in ${bankDir}`);
}

/** `  <path>: <message>` lines. */
export function formatErrors(errors: ValidationError[]): string {
  return errors.map((e) => `  ${e.path}: ${e.message}`).join("\n");
}

/** Prints `message` to stderr and exits 2 (usage or setup problem, as opposed to 1 for invalid questions). */
export function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

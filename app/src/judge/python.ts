import { execFile } from "node:child_process";

export interface PythonInfo {
  /** Absolute path of the interpreter executable (`sys.executable`). */
  path: string;
  /** e.g. `3.13.1` */
  version: string;
}

export type DiscoverResult = { ok: true; python: PythonInfo } | { ok: false; error: string };

const PROBE = "import sys; print(sys.executable); print('%d.%d.%d' % sys.version_info[:3])";
const PROBE_TIMEOUT_MS = 10_000;

/**
 * Finds a Python 3 interpreter: the explicit `override` if given, else python3, python,
 * then `py -3` on Windows. Resolves to the real executable path so callers can spawn it directly.
 */
export async function discoverPython(override?: string): Promise<DiscoverResult> {
  if (override) {
    const python = await probe(override, []);
    return python
      ? { ok: true, python }
      : { ok: false, error: `"${override}" is not a working Python 3 interpreter` };
  }
  const candidates: [string, string[]][] = [
    ["python3", []],
    ["python", []],
    ...(process.platform === "win32" ? [["py", ["-3"]] as [string, string[]]] : []),
  ];
  for (const [command, args] of candidates) {
    const python = await probe(command, args);
    if (python) return { ok: true, python };
  }
  return {
    ok: false,
    error: `No Python 3 found (tried ${candidates.map(([c, a]) => [c, ...a].join(" ")).join(", ")}). Install Python 3 or set its path in settings.`,
  };
}

function probe(command: string, args: string[]): Promise<PythonInfo | undefined> {
  return new Promise((resolve) => {
    execFile(
      command,
      [...args, "-c", PROBE],
      { timeout: PROBE_TIMEOUT_MS, windowsHide: true },
      (err, stdout) => {
        if (err) return resolve(undefined);
        const [path, version] = stdout.trim().split(/\r?\n/);
        if (!path || !version || !version.startsWith("3.")) return resolve(undefined);
        resolve({ path, version });
      },
    );
  });
}

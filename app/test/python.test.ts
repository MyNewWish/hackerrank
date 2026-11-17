import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverPython } from "../src/judge";

describe("discoverPython", () => {
  test("finds the local Python 3 and reports its executable path and version", async () => {
    const found = await discoverPython();

    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.python.version).toMatch(/^3\.\d+\.\d+/);
    expect(existsSync(found.python.path)).toBe(true);
  });

  test("honours an explicit override", async () => {
    const auto = await discoverPython();
    if (!auto.ok) throw new Error("no local python");

    const overridden = await discoverPython(auto.python.path);

    expect(overridden).toEqual(auto);
  });

  test("reports a clear error for an override that is not a Python", async () => {
    const bogus = join(tmpdir(), "definitely-not-python-xyz");
    const found = await discoverPython(bogus);

    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.error).toContain(bogus);
  });
});

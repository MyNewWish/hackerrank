// The pyright server entry's path in dev and packaged builds.
import { expect, test } from "bun:test";
import { unpackedServerEntry } from "../src/lsp/pyright";

test("a packaged Windows path points into app.asar.unpacked", () => {
  expect(unpackedServerEntry(String.raw`C:\Program Files\HackerRank\resources\app.asar\node_modules\pyright\langserver.index.js`)).toBe(
    String.raw`C:\Program Files\HackerRank\resources\app.asar.unpacked\node_modules\pyright\langserver.index.js`,
  );
});

test("a packaged POSIX path points into app.asar.unpacked", () => {
  expect(unpackedServerEntry("/Applications/HackerRank.app/Contents/Resources/app.asar/node_modules/pyright/langserver.index.js")).toBe(
    "/Applications/HackerRank.app/Contents/Resources/app.asar.unpacked/node_modules/pyright/langserver.index.js",
  );
});

test("a dev path from node_modules is unchanged", () => {
  const dev = String.raw`C:\repo\hackerrank\app\node_modules\pyright\langserver.index.js`;
  expect(unpackedServerEntry(dev)).toBe(dev);
});

test("a folder only named like the archive is unchanged", () => {
  for (const path of [
    "/home/me/app.asar.unpacked/node_modules/pyright/langserver.index.js",
    "/home/me/my-app.asar/node_modules/pyright/langserver.index.js",
  ]) {
    expect(unpackedServerEntry(path)).toBe(path);
  }
});

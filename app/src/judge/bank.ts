import { readdirSync } from "node:fs";
import { join } from "node:path";
import { loadQuestion, questionIdFromFolder } from "./loader";
import type { LoadResult } from "./types";

const QUESTION_FOLDER = /^q(\d+)_/;

export type BankEntry = { id: string; folder: string; dir: string } & LoadResult;

/** Lists `q<N>_<slug>` folders in `bankDir`, sorted by N, each loaded or carrying its errors. */
export function scanBank(bankDir: string): BankEntry[] {
  return readdirSync(bankDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ folder: entry.name, match: QUESTION_FOLDER.exec(entry.name) }))
    .filter(({ match }) => match !== null)
    .sort((a, b) => Number(a.match![1]) - Number(b.match![1]) || a.folder.localeCompare(b.folder))
    .map(({ folder }) => {
      const dir = join(bankDir, folder);
      return { id: questionIdFromFolder(folder), folder, dir, ...loadQuestion(dir) };
    });
}

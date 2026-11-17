/** `bun run gen <questionId> [--force]`: write expected outputs by running reference.py. */
import { generateOutputs } from "../authoring";
import { fail, findQuestion, formatErrors, parseCliArgs } from "./common";

const USAGE = "gen <questionId> [--force] [--bank <dir>] [--python <path>]";

const { positionals, force, bankDir, python } = await parseCliArgs(USAGE, true);
const [id] = positionals;
if (id === undefined || positionals.length > 1) fail(`usage: ${USAGE}`);
const entry = findQuestion(bankDir, id);

const report = await generateOutputs({ python, questionDir: entry.dir, force });
for (const path of report.written) console.log(`  wrote ${path}`);
console.log(`${entry.folder}: wrote ${report.written.length} output(s)${force ? " (forced)" : ""}`);
if (report.failed.length > 0) {
  console.error(`${entry.folder}: ${report.failed.length} failure(s)\n${formatErrors(report.failed)}`);
  process.exit(1);
}

/** `bun run validate [questionId]`: check one question, or the whole bank, and its reference. */
import { validateQuestion } from "../authoring";
import { scanBank } from "../judge";
import { fail, findQuestion, formatErrors, parseCliArgs } from "./common";

const USAGE = "validate [questionId] [--bank <dir>] [--python <path>]";

const { positionals, bankDir, python } = await parseCliArgs(USAGE);
if (positionals.length > 1) fail(`usage: ${USAGE}`);
const [id] = positionals;
const entries = id === undefined ? scanBank(bankDir) : [findQuestion(bankDir, id)];
if (entries.length === 0) fail(`no q<N>_<slug> question folders in ${bankDir}`);

let broken = 0;
for (const entry of entries) {
  const errors = await validateQuestion({ python, questionDir: entry.dir });
  if (errors.length === 0) {
    console.log(`${entry.folder}: OK`);
  } else {
    broken++;
    console.log(`${entry.folder}: ${errors.length} problem(s)\n${formatErrors(errors)}`);
  }
}
if (broken > 0) {
  console.log(`\n${broken} of ${entries.length} question(s) invalid`);
  process.exit(1);
}

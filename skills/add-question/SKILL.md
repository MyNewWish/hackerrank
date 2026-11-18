---
name: add-question
description: Add a question to the practice bank (questions/q<N>_<slug>) from pasted problem text or a URL. Use when the user asks to add, import or create a bank question.
---

# Add a question to the bank

Turn a source problem into a complete stdin → stdout question that `bun run validate` accepts:

```
questions/q<N>_<slug>/
  problem.md
  question.yaml
  reference.py
  tests/<partId>/sample/NN.in|.out
  tests/<partId>/hidden/NN.in|.out
```

`q1`–`q6` are the prior art for structure, tone and test layout; open one before drafting.

The core risk: `bun run gen` writes every expected output *from* `reference.py`, so a buggy reference produces buggy tests that it passes. The **oracle** against that is the sample outputs you write by hand from the statement *before* the reference exists. Treat them as fixed: a mismatch is evidence about the reference or the spec, never a file to regenerate.

Run every `bun` command from `app/`. Add `--python <path>` if Python isn't found, `--bank <dir>` for a bank other than `questions/`.

## 1. Get the source

Use the pasted text, or fetch the URL with whatever web tool you have. If you have none, or the page is behind a login or blocked, ask the user to paste the content and wait.

Done when you hold the full problem text, including every worked example.

## 2. Draft the spec

- **Rewrite** the statement in the bank's own words; never copy the source's prose. Credit the source URL at the end of `problem.md`.
- **Parts**: 3–4 progressive parts, Stripe-screen style, each building on the previous one. Split a single-part source only where the split is natural; three honest parts beat four invented ones.
- **Explicit rules**: every rule a test will rely on is written down: tie-breaks, ordering, number formatting, error precedence, malformed-input handling, empty input. A hidden test may only check a rule a candidate can read.
- **Contradictions**: list every place the source contradicts itself or has a wrong example, with the rule you propose.
- **Name**: the next free `N` after the highest existing `questions/q<N>_*`, and a short snake_case slug.
- **Metadata**: infer `difficulty` (easy, medium, hard), `tags` (reuse existing tags where they fit; `stripe` for Stripe-reported problems) and `targetMinutes`.

One `reference.py` answers every part's tests, so a later part's rules must leave earlier parts' outputs unchanged on earlier parts' inputs. Shape the parts so that holds.

Done when each part has a title, its rules, and a worked example you can compute by hand.

## 3. Checkpoint

Present to the user, then **wait for approval** before writing any file:

- the folder name and the part breakdown (id, title, one line each),
- the rules you filled in that the source didn't state,
- the source contradictions and the rule you chose for each,
- `title`, `difficulty`, `tags`, `targetMinutes`.

Apply the user's corrections. Done when the user approves.

## 4. Write the statement and the oracle

- `problem.md` from [problem-template.md](problem-template.md).
- `question.yaml` from [question-template.yaml](question-template.yaml). Part ids match the `tests/` folder names.
- Per part, `tests/<partId>/sample/01.in` and `01.out`: the part's worked example from `problem.md`, byte for byte, with the output computed **by hand** from the rules. Add `02` and on for further examples.

Done when every part has hand-written samples and `reference.py` does not yet exist.

## 5. Write the reference

`reference.py` reads stdin and writes stdout, like the existing references: a docstring naming the problem and the input shape, clean readable Python, integer cents or `Decimal` for money, deterministic output. It implements every part.

## 6. Write hidden inputs

Per part, 3–6 inputs in `tests/<partId>/hidden/01.in` …, each aimed at a named edge case from [edge-cases.md](edge-cases.md). Write the `.in` files only.

Make large or performance inputs with a throwaway generator script kept outside the repo (a temp or scratch folder); save only the `.in` it produces into the question. Keep inputs well inside the question's time limit (`timeLimitMs`, default 5000 ms).

Done when every part has 3–6 hidden inputs and each maps to an edge case you can name.

## 7. Generate and validate

```
bun run gen q<N>
bun run validate q<N>
```

`gen` fills only the missing `.out` files, so the hand-written samples stay as written. Run it plain, every time: `--force` would overwrite the oracle with the reference's opinion.

When `validate` reports a sample mismatch, decide which side is wrong:

- **Reference wrong** (it breaks a rule `problem.md` states): fix `reference.py`, then delete every hidden `.out` (the bug may have shaped any of them) and run `gen` again.
- **Spec wrong** (the hand computation or the rule itself was mistaken): fix `problem.md` and the sample by hand together, and record it for the final report as a change to the approved spec.

When a hidden test fails, it is the reference's own output, so the cause is the test setup: a stale `.out` from before a fix (delete it and run `gen` again), or a timeout (make the reference faster, or the input smaller if it exceeds what the question means to test).

Then hand-check at least one hidden output per part against `problem.md`, working it out from the rules, not from the reference.

Done when `bun run validate q<N>` prints `OK` and one hidden output per part is hand-checked.

## 8. Finish

- Report to the user: every file created, every assumption and filled-in rule, any spec change from step 7, and which hidden outputs you hand-checked.

Stop there, with the files left uncommitted in the working tree. Version control is the user's: they review, then commit, branch and open any PR themselves.

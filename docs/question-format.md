# Question format

Every question in the bank is a folder under `questions/`. The app finds it by that name.

```
questions/q<N>_<slug>/
  problem.md                      # the statement shown in the app
  question.yaml                   # title, difficulty, tags, target time, parts
  reference.py                    # a full solution: reads stdin, writes stdout
  tests/<partId>/sample/NN.in|.out   # shown to you, run by Run
  tests/<partId>/hidden/NN.in|.out   # not shown, run by Submit
```

The app sorts questions by `N`. Your own code is saved outside the bank, in `workspace/q<N>_solution.py`.

## question.yaml

```yaml
title: Accept-Language negotiation
difficulty: medium            # easy | medium | hard
tags: [stripe, parsing, http]
targetMinutes: 45
# timeLimitMs: 5000           # per test run, default 5000
# compare: lines              # lines (default) | exact | float:<eps>
parts:
  - { id: part1, title: Exact matches }
  - { id: part2, title: Language-only tags }
```

Each part `id` must match a folder under `tests/`.

## Compare modes

| Mode | Output passes when |
|---|---|
| `lines` (default) | each line matches after trailing whitespace on the line and trailing empty lines are ignored |
| `exact` | it matches byte for byte (only line endings are normalised) |
| `float:<eps>` | every token matches, and numeric tokens are within `eps` |

The real HackerRank screen grades with **strict output matching**. If you want to practise
under that rule, set `compare: exact` on a question.

## Adding a question

The easy way: ask your coding agent to add one. The `add-question` skill (`skills/add-question/SKILL.md`)
turns pasted problem text or a URL into a complete question.

By hand, run these from `app/`:

1. Make the folder with `problem.md`, `question.yaml`, `reference.py`, and the `.in` files.
   Write the sample `.out` files by hand from the statement.
2. `bun run gen q<N>`: fills in any missing `.out` files by running `reference.py`.
3. `bun run validate q<N>`: checks the folder and that the reference passes every test. With no argument it checks the whole bank.

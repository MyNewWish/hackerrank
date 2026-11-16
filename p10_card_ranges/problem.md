# P10 — Card range obfuscation  (target: 40 min for all parts)

Source: "Card Range Obfuscation" from extrabrain's Stripe HackerRank OA list.
A 6-digit BIN covers every 16-digit card number that starts with it. For example,
BIN `424242` covers `4242420000000000` through `4242429999999999`. An internal service
returns brand intervals inside a BIN, as 10-digit offsets. Before showing them to users,
we have to return intervals that cover the **whole** BIN with no gaps.

```python
def obfuscate(bin6: str, intervals: list[str]) -> list[str]
def solve(text: str) -> str      # HackerRank-style: reads the raw stdin text, returns stdout
```

Each interval is `"start,end,brand"`, where `start` and `end` are 10-digit offsets
(zero padding may be missing). Intervals never overlap. Skip malformed lines.
Each output line is `"<16-digit start>,<16-digit end>,brand"`, sorted by start. Output
numbers are the BIN followed by the offset **zero-padded to 10 digits**.

`solve` input format (the extrabrain page lost its line breaks; this is the most likely
layout):
```
777777
2
1000000000,3999999999,VISA
4000000000,5999999999,MASTERCARD
```

## Part 1 — format
The intervals are already sorted and cover `0000000000..9999999999`. Convert them to
16-digit numbers and implement `solve`.

## Part 2 — unsorted input with gaps
The intervals may come in any order and leave gaps. Fill every gap:
- A gap **before the first** interval extends that interval down to `0000000000`.
- A gap **between** intervals extends the earlier interval up to the next one's start - 1.
- A gap **after the last** interval extends it up to `9999999999`.

```
777777 / 4000000000,5999999999,MASTERCARD / 1000000000,3999999999,VISA
-> 7777770000000000,7777773999999999,VISA
   7777774000000000,7777779999999999,MASTERCARD
```

## Part 3 — merge
After filling gaps, merge neighbouring intervals that have the same brand into one.
Output must be a minimal list.

Note: the example on the extrabrain page doesn't fill the trailing gap, which
contradicts its own rule. These tests follow the rule.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

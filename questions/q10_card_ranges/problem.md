# Card range obfuscation

A 6-digit BIN covers every 16-digit card number that starts with it. For example,
BIN `424242` covers `4242420000000000` through `4242429999999999`. An internal service
returns brand intervals inside a BIN, as 10-digit offsets. Before showing them to users,
we have to return intervals that cover the **whole** BIN with no gaps.

Each interval is `START,END,BRAND`, where `START` and `END` are offsets from
`0000000000` to `9999999999` (zero padding may be missing). Intervals never overlap.
Ignore whitespace around each field. Skip malformed lines: not exactly 3 fields, a
non-integer offset, an offset out of range, `START > END`, or an empty brand.

## Input Format

1. The 6-digit BIN.
2. An integer `N`, the number of interval lines.
3. `N` interval lines `START,END,BRAND`.

Blank lines are ignored.

```
777777
2
1000000000,3999999999,VISA
4000000000,5999999999,MASTERCARD
```

## Output Format

One line per output interval, sorted by start:
`<16-digit start>,<16-digit end>,BRAND`. Each 16-digit number is the BIN followed by
the offset **zero-padded to 10 digits**. If no line is valid, print the single line
`NONE`.

```
7777770000000000,7777773999999999,VISA
7777774000000000,7777779999999999,MASTERCARD
```

## Part 1 — Format

The intervals are already sorted and together cover `0000000000..9999999999`. Convert
them to 16-digit numbers.

Input:
```
424242
2
0000000000,4999999999,VISA
5000000000,9999999999,VISA_DEBIT
```
Output:
```
4242420000000000,4242424999999999,VISA
4242425000000000,4242429999999999,VISA_DEBIT
```

## Part 2 — Unsorted input with gaps

The intervals may come in any order and leave gaps. Fill every gap:

- A gap **before the first** interval extends that interval down to `0000000000`.
- A gap **between** intervals extends the earlier interval up to the next one's start - 1.
- A gap **after the last** interval extends it up to `9999999999`.

Input:
```
777777
2
4000000000,5999999999,MASTERCARD
1000000000,3999999999,VISA
```
Output:
```
7777770000000000,7777773999999999,VISA
7777774000000000,7777779999999999,MASTERCARD
```

## Part 3 — Merge

After filling gaps, merge neighbouring intervals that have the same brand into one.
The output must be a minimal list.

Input:
```
333333
3
0000000000,1999999999,VISA
3000000000,4999999999,VISA
5000000000,9999999999,MC
```
Output:
```
3333330000000000,3333334999999999,VISA
3333335000000000,3333339999999999,MC
```

Note: the example on the extrabrain page doesn't fill the trailing gap, which
contradicts its own rule. These tests follow the rule.

---

Source: ["Card Range Obfuscation"](https://extrabrain.app/interview-questions/stripe-hackerrank-online-assessment-extrabrain/) on extrabrain's Stripe HackerRank OA list.
Rewritten for this bank; the rules above fill gaps
and fix errors in the original, so they win where the two differ.

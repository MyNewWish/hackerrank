# Store closing time penalty

Source: "Store Closing Time Penalty" from extrabrain's Stripe HackerRank OA list.

A store log is a sequence of `Y` (customers came that hour) and `N` (no customers)
tokens, separated by any whitespace (spaces or tabs). Closing time `t` is an integer from
`0` to `n`, where `n` is the number of hours: the store is open for the first `t` hours
and closed for the rest (`0` means it never opens; `n` means it stays open all hours).

Penalty for closing time `t`:
- +1 for every **open** hour with `N` (hours before `t`)
- +1 for every **closed** hour with `Y` (hours at or after `t`)

For the log `Y Y N Y`, the penalties for `t = 0..4` are `3 2 1 2 1`.

## Input Format

1. An integer `Q`, the number of queries.
2. `Q` queries. Each query is one of the commands described in the parts below:
   - `PENALTY t <log>` (Part 1): one line.
   - `BEST <log>` (Part 2): one line.
   - `STREAM k` (Part 3): a header line followed by `k` lines of an aggregate log.

The log is the rest of the line after the command (and `t`); it may be empty.

```
2
PENALTY 2 Y Y N Y
BEST Y Y N Y
```

## Output Format

One line per query, in order:
- `PENALTY`: the penalty, an integer.
- `BEST`: the best closing time, an integer.
- `STREAM`: the best closing times of the valid logs, separated by single spaces, or
  `NONE` if there are none.

```
1
2
```

## Part 1 — Penalty

`PENALTY t <log>`: print the penalty of closing at `t`, or `-1` if `t` is outside `0..n`.
An empty log has `n = 0`.

Input:
```
5
PENALTY 0 Y Y N Y
PENALTY 1 Y Y N Y
PENALTY 2 Y Y N Y
PENALTY 3 Y Y N Y
PENALTY 4 Y Y N Y
```
Output:
```
3
2
1
2
1
```

## Part 2 — Best closing time

`BEST <log>`: print the closing time with the smallest penalty. On ties, print the
smallest one. It must run in **O(n)**: a log can have 200,000 hours. Hint: going from `t`
to `t+1` changes the penalty by -1 if hour `t` is `Y` and +1 if it is `N`.

Input:
```
3
BEST Y Y N Y
BEST N N N
BEST Y Y Y
```
Output:
```
2
0
3
```

`Y Y N Y` ties between `2` and `4`, so the answer is `2`.

## Part 3 — Aggregate logs

`STREAM k` is followed by `k` lines that form one stream of tokens (line breaks are just
whitespace). A valid log is `BEGIN`, then zero or more `Y` or `N` tokens, then `END`. Print
the best closing time of each valid log, in order of appearance.
- Tokens outside a log are ignored.
- A `BEGIN` inside an open log **discards** the open log and starts a new one (nested logs
  aren't valid).
- Any other token inside a log invalidates that log.
- A log still open at the end of the stream is ignored.

Input:
```
2
STREAM 3
BEGIN Y
Y END
BEGIN BEGIN N N END Y END BEGIN Y
STREAM 1
BEGIN Y Y N Y END
```
Output:
```
2 0
2
```

In the first stream, `BEGIN Y Y END` gives `2`; the second `BEGIN` discards the first and
`N N END` gives `0`; `Y END` is outside a log, and the final `BEGIN Y` is never closed.

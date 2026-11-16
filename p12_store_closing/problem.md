# P12 — Store closing time penalty  (target: 40 min for all parts)

Source: "Store Closing Time Penalty" from extrabrain's Stripe HackerRank OA list.

A store log is a space-separated sequence of `Y` (customers came that hour) and `N` (no
customers). Closing time `t` is an integer from `0` to `n`: the store is open for the first
`t` hours and closed for the rest (`0` means it never opens; `n` means it stays open all hours).

Penalty for closing time `t`:
- +1 for every **open** hour with `N` (hours before `t`)
- +1 for every **closed** hour with `Y` (hours at or after `t`)

```
log "Y Y N Y": penalties for t = 0..4 are [3, 2, 1, 2, 1]
```

## Part 1 — `compute_penalty(log: str, closing_time: int) -> int`
Return `-1` if `closing_time` is outside `0..n`.

## Part 2 — `find_best_closing_time(log: str) -> int`
Return the closing time with the smallest penalty. On ties, return the smallest one.
Must run in **O(n)**; the test uses 200,000 hours. Hint: going from `t` to `t+1`
changes the penalty by -1 if hour `t` is `Y` and +1 if it is `N`.

## Part 3 — `get_best_closing_times(aggregate_log: str) -> list[int]`
The input is a stream of tokens across any number of lines. A valid log is `BEGIN`,
then zero or more `Y` or `N` tokens, then `END`. Return the best closing time of each
valid log, in order of appearance.
- Tokens outside a log are ignored.
- A `BEGIN` inside an open log **discards** the open log and starts a new one (nested logs
  aren't valid).
- Any other token inside a log invalidates that log.
- A log still open at the end of the input is ignored.

```
"BEGIN Y\nY END\nBEGIN BEGIN N N END Y END BEGIN Y"  ->  [2, 0]
```

Run: `python test.py` (your solution) or `python test.py ref` (reference).

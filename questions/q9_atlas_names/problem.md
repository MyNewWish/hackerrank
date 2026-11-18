# P9 — Atlas company name check  (target: 45 min for all parts)

Source: "Atlas Company Name Check" from extrabrain's Stripe HackerRank OA list.
Stripe Atlas registers companies. Two names that differ only in punctuation, casing,
suffixes or filler words count as **the same name**.

## Part 1 — `check_names(requests) -> list[str]`
Each request is `"account_id|proposed name"`. For each request, output
`"account_id|Name Available"` or `"account_id|Name Not Available"`. An available name
is registered immediately, so later requests for the same normalized name are
Not Available. Skip lines that have no `|`.

Normalize a name by applying these steps in this order:
1. Lowercase it.
2. Replace `&` and `,` with spaces.
3. Split on whitespace (this collapses repeated spaces).
4. Drop every token equal to `inc.`, `corp.`, `llc`, `l.l.c.` or `llc.`.
5. Drop a single leading `the`, `an` or `a`.
6. Drop every `and` except one at position 0 (position counted after step 5).
7. Join the remaining tokens with single spaces. **An empty result is never available.**

```
"The Best & Co, Inc."  -> "best co"
"Best and Co LLC"      -> "best co"      (same name)
"And Partners"         -> "and partners" (a leading "and" is kept)
"Theory"               -> "theory"       (only the whole token "the" counts as an article)
```

## Part 2 — persistence
Add a class `NameRegistry` with `process(requests) -> list[str]` that keeps its
registrations across calls, so later batches see earlier names. Separate instances are
independent. `normalize(name)` must be importable and reusable on its own.
`check_names` is just `NameRegistry().process(requests)`.

## Part 3 — reclaiming names
A request `"RECLAIM,account_id,original proposed name"` releases a name. It succeeds
only if this account registered exactly this original string (compared after trimming
whitespace) and still holds it. Output `"account_id|Reclaimed"` or
`"account_id|Reclaim Denied"`. After a successful reclaim, anyone can register the name.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

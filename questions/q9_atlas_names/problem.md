# Atlas company name check

Stripe Atlas registers companies. Two names that differ only in punctuation, casing,
suffixes or filler words count as **the same name**.

Normalize a name by applying these steps in this order:

1. Lowercase it.
2. Replace `&` and `,` with spaces.
3. Split on whitespace (this collapses repeated spaces).
4. Drop every token equal to `inc.`, `corp.`, `llc`, `l.l.c.` or `llc.`.
5. Drop a single leading `the`, `an` or `a`.
6. Drop every `and` except one at position 0 (position counted after step 5).
7. Join the remaining tokens with single spaces.

```
The Best & Co, Inc.  -> best co
Best and Co LLC      -> best co        (same name)
And Partners         -> and partners   (a leading "and" is kept)
Theory               -> theory         (only the whole token "the" counts as an article)
```

## Input Format

1. An integer `N`, the number of request lines.
2. `N` request lines, processed in order by one registry. Each line is one of the
   requests described in the parts below. Lines may have leading or trailing spaces.

```
3
a1|Stripe Inc.
a2|stripe
a3|Acme & Co
```

## Output Format

One line per request that produces output, in request order. Skipped lines print
nothing.

```
a1|Name Available
a2|Name Not Available
a3|Name Available
```

## Part 1 — Name availability

A request `ACCOUNT_ID|PROPOSED NAME` (split at the first `|`; trim both sides) asks for a
name. Print `ACCOUNT_ID|Name Available` or `ACCOUNT_ID|Name Not Available`. An available
name is registered to that account immediately, so later requests for the same
normalized name are Not Available. **An empty normalized name is never available.**
Skip lines that have no `|`.

Input:
```
5
a1|Stripe Inc.
a2|stripe
a3|The Stripe LLC
a4|Acme & Co
a5|Acme and Co, LLC.
```
Output:
```
a1|Name Available
a2|Name Not Available
a3|Name Not Available
a4|Name Available
a5|Name Not Available
```

## Part 2 — Normalize and reset

Two more requests:

- `NORMALIZE NAME` prints the normalized form of `NAME` (everything after the first
  space), or `(empty)` if it normalizes to nothing. It does not register anything.
- `RESET` (the whole line) forgets every registration, as if a new registry had been
  created. It prints nothing.

Registrations persist across all other requests until a `RESET`.

Input:
```
5
NORMALIZE The Foo & Bar, Inc.
x|Foo Inc.
y|foo
RESET
y|foo
```
Output:
```
foo bar
x|Name Available
y|Name Not Available
y|Name Available
```

## Part 3 — Reclaiming names

A request `RECLAIM,ACCOUNT_ID,ORIGINAL PROPOSED NAME` (split at the first two commas)
releases a name. It succeeds only if this account registered exactly this original
string (both compared after trimming whitespace) and still holds it. Print
`ACCOUNT_ID|Reclaimed` or `ACCOUNT_ID|Reclaim Denied`. After a successful reclaim, anyone
can register the name.

Input:
```
5
a|Foo LLC
b|foo
RECLAIM,b,foo
RECLAIM,a,Foo
RECLAIM,a, Foo LLC 
```
Output:
```
a|Name Available
b|Name Not Available
b|Reclaim Denied
a|Reclaim Denied
a|Reclaimed
```

---

Source: ["Atlas Company Name Check"](https://extrabrain.app/interview-questions/stripe-hackerrank-online-assessment-extrabrain/) on extrabrain's Stripe HackerRank OA list.
Rewritten for this bank; the rules above fill gaps
and fix errors in the original, so they win where the two differ.

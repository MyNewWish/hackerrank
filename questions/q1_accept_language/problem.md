# Accept-Language negotiation

Reported in real Stripe screens. HTTP clients send an `Accept-Language` header
listing languages they want. Your server supports a fixed set of language tags.

Find the supported tags that work for the request, **in preference order**,
using the casing from the supported list. Each supported tag appears at most once.

## Input Format

Exactly two lines:

1. The `Accept-Language` header value, verbatim (it may contain spaces).
2. The supported tags, separated by single spaces, in the server's order.

```
en-US, fr-CA, fr-FR
fr-FR en-US
```

## Output Format

The matching supported tags, one per line, in preference order, spelled as in
the supported list. If no supported tag matches, print the single line `NONE`.

```
en-US
fr-FR
```

## Part 1 — Exact matches

The header is a comma-separated list like `en-US, fr-CA, fr-FR`.
Print the supported tags that exactly match an entry, ordered by that entry's position in the header.
Matching is case-insensitive; ignore whitespace around entries.

Input:
```
en-US, fr-CA, fr-FR
fr-FR en-US
```
Output:
```
en-US
fr-FR
```

Input:
```
fr-CA, fr-FR
en-US fr-FR
```
Output:
```
fr-FR
```

## Part 2 — Language-only tags

A header entry may be a bare language (`en`). It matches every supported tag
with that language (`en-US`, `en-GB`, but NOT `eng-XX`).
If a tag is matched by several entries, the **most specific** entry wins
(exact beats language-only), and that entry's header position is used for ordering.
Ties among tags matched by the same entry keep the order of the supported list.

Input:
```
fr
en-US fr-CA fr-FR
```
Output:
```
fr-CA
fr-FR
```

Input:
```
fr-FR, fr
en-US fr-CA fr-FR
```
Output:
```
fr-FR
fr-CA
```

## Part 3 — Wildcard

`*` matches every supported tag (least specific of all).

Input:
```
fr-FR, fr, *
en-US fr-CA fr-FR
```
Output:
```
fr-FR
fr-CA
en-US
```

## Part 4 — Quality factors

Entries may carry a weight: `fr-FR;q=1, fr-CA;q=0, fr;q=0.5`. The default `q` is 1.

- Sort the result by q descending; ties fall back to the Part 1–3 ordering.
- A tag whose most specific match has `q=0` is **excluded** (even if `*` would match it).

Input:
```
fr-FR;q=1, fr-CA;q=0, fr;q=0.5
fr-FR fr-CA fr-BG
```
Output:
```
fr-FR
fr-BG
```

Input:
```
fr;q=0.2, en-US;q=0.9
fr-FR en-US
```
Output:
```
en-US
fr-FR
```

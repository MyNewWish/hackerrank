# P1 — Accept-Language negotiation  (target: 45 min for all parts)

Reported in real Stripe screens. HTTP clients send an `Accept-Language` header
listing languages they want. Your server supports a fixed set of language tags.

Implement in `solution.py`:

```python
def parse_accept_language(header: str, supported: list[str]) -> list[str]
```

Return the supported tags that work for the request, **in preference order**,
using the casing from `supported`. Each supported tag appears at most once.

## Part 1 — exact matches
Header is a comma-separated list like `"en-US, fr-CA, fr-FR"`.
Return supported tags that exactly match, ordered by their position in the header.
Matching is case-insensitive; ignore surrounding whitespace.

```
("en-US, fr-CA, fr-FR", ["fr-FR", "en-US"])  ->  ["en-US", "fr-FR"]
("fr-CA, fr-FR",        ["en-US", "fr-FR"])  ->  ["fr-FR"]
```

## Part 2 — language-only tags
A header entry may be a bare language (`"en"`). It matches every supported tag
with that language (`en-US`, `en-GB`, but NOT `eng-XX`).
If a tag is matched by several entries, the **most specific** entry wins
(exact beats language-only), and that entry's header position is used for ordering.
Ties among tags matched by the same entry keep the order of `supported`.

```
("fr",            ["en-US", "fr-CA", "fr-FR"])  ->  ["fr-CA", "fr-FR"]
("fr-FR, fr",     ["en-US", "fr-CA", "fr-FR"])  ->  ["fr-FR", "fr-CA"]
```

## Part 3 — wildcard
`*` matches every supported tag (least specific of all).

```
("fr-FR, fr, *",  ["en-US", "fr-CA", "fr-FR"])  ->  ["fr-FR", "fr-CA", "en-US"]
```

## Part 4 — quality factors
Entries may carry a weight: `"fr-FR;q=1, fr-CA;q=0, fr;q=0.5"`. Default `q` is 1.
- Sort the result by q descending; ties fall back to the Part 1-3 ordering.
- A tag whose most-specific match has `q=0` is **excluded** (even if `*` would match it).

```
("fr-FR;q=1, fr-CA;q=0, fr;q=0.5", ["fr-FR", "fr-CA", "fr-BG"])  ->  ["fr-FR", "fr-BG"]
("fr;q=0.2, en-US;q=0.9",          ["fr-FR", "en-US"])           ->  ["en-US", "fr-FR"]
```

Run: `python test.py` (your solution) or `python test.py ref` (reference).

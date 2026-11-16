# P5 — Request router  (target: 60 min for all parts)

Reported as "Request Routing System" in 2026 Stripe HackerRank OAs (several reports).

```python
def route(rules: list[str], lines: list[str]) -> list[str]
```

A rule looks like `"GET /api/users -> users-svc"`. Each line is either a request
`"GET /api/users"` or (Part 4) a health event. Return one output per **request**:
the backend name, or `"404"` if no rule matches. Skip malformed rules.

## Part 1 — exact routes
- Match method and path exactly. Method is case-insensitive.
- Normalize paths: ignore the query string (`?limit=10`) and empty segments
  (`/api/users/` == `/api/users`).

```
rules: ["GET /api/users -> users", "POST /api/users -> users-write"]
"GET /api/users?limit=5" -> users       "DELETE /api/users" -> 404
```

## Part 2 — patterns and precedence
- `:name` matches any single segment: `GET /api/users/:id`.
- A trailing `*` matches zero or more remaining segments: `GET /api/*`.
- Method `*` matches any method: `* /health -> health`.
- If several rules match, pick the most specific one. Compare segment by segment,
  left to right: literal > `:param` > `*`. A pattern that ends exactly where the path ends
  beats a `*` at that position. Next, a specific method beats `*`. Last, the rule listed
  earlier wins.

```
"GET /api/users/42"       -> user-detail   (via /api/users/:id)
"GET /api/users/42/cards" -> api           (via /api/*)
```

## Part 3 — weighted backends
`"GET /pay -> a:3,b:1"`: the weight defaults to 1. Each rule cycles through its expanded
list `[a, a, a, b]` in order, one entry per request. Each rule has its own cursor.

## Part 4 — health
Lines can also be `"DOWN a"` or `"UP a"`. They produce no output. Health is global
by backend name. When picking a backend, start at the rule's cursor and skip DOWN
entries. Return `"503"` if all of the rule's backends are down. In that case the
cursor doesn't move.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

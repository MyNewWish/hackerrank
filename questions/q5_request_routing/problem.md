# Request router

Reported as "Request Routing System" in 2026 Stripe HackerRank OAs (several reports).

A rule looks like `GET /api/users -> users-svc`. Each input line is either a request
`GET /api/users` or (Part 4) a health event. Answer every **request** with the
backend name, or `404` if no rule matches. Skip malformed rules.

## Input Format

1. An integer `R`, the number of rules.
2. `R` rule lines.
3. An integer `N`, the number of request/event lines.
4. `N` lines, each a request `METHOD PATH` or (Part 4) a health event.

```
2
GET /api/users -> users
POST /api/users -> users-write
2
GET /api/users?limit=5
DELETE /api/users
```

## Output Format

One line per request, in order: the chosen backend, `404`, or (Part 4) `503`.
Health events print nothing.

```
users
404
```

## Part 1 — Exact routes

- Match method and path exactly. Method is case-insensitive.
- Normalize paths: ignore the query string (`?limit=10`) and empty segments
  (`/api/users/` == `/api/users`).

Input:
```
2
GET /api/users -> users
POST /api/users -> users-write
2
GET /api/users?limit=5
DELETE /api/users
```
Output:
```
users
404
```

## Part 2 — Patterns and precedence

- `:name` matches any single segment: `GET /api/users/:id`.
- A trailing `*` matches zero or more remaining segments: `GET /api/*`.
- Method `*` matches any method: `* /health -> health`.
- If several rules match, pick the most specific one. Compare segment by segment,
  left to right: literal > `:param` > `*`. A pattern that ends exactly where the path ends
  beats a `*` at that position. Next, a specific method beats `*`. Last, the rule listed
  earlier wins.

Input:
```
7
GET /api/users -> users
POST /api/users -> users-write
GET /api/users/:id -> user-detail
GET /api/* -> api
* /health -> health
GET /* -> web
GET /api/users -> dup
2
GET /api/users/42
GET /api/users/42/cards
```
Output:
```
user-detail
api
```

The first request matches `/api/users/:id`; the second only matches `/api/*` and `/*`.

## Part 3 — Weighted backends

`GET /pay -> a:3,b:1`: the weight defaults to 1. Each rule cycles through its expanded
list `[a, a, a, b]` in order, one entry per request. Each rule has its own cursor.

Input:
```
2
GET /pay -> a:3,b:1
GET /x -> c
6
GET /pay
GET /x
GET /pay
GET /pay
GET /pay
GET /pay
```
Output:
```
a
c
a
a
b
a
```

## Part 4 — Health

Lines can also be `DOWN a` or `UP a`. They produce no output. Health is global
by backend name. When picking a backend, start at the rule's cursor and skip DOWN
entries. Print `503` if all of the rule's backends are down. In that case the
cursor doesn't move.

Input:
```
2
GET /pay -> a:2,b:1
GET /other -> b
13
GET /pay
DOWN a
GET /pay
GET /pay
UP a
GET /pay
DOWN a
DOWN b
GET /pay
GET /other
UP b
GET /pay
GET /other
```
Output:
```
a
b
b
a
503
503
b
b
```

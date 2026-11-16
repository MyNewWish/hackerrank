# P2 — Shipping cost  (target: 50 min for all parts)

Reported in real Stripe phone screens (same shape as the "currency conversion"
question — a weighted graph hidden inside a string).

Input is a string of shipping lanes `SRC:DST:CARRIER:COST` separated by commas:

```
"US:UK:UPS:5,US:UK:DHL:4,UK:FR:DHL:3,US:CA:FedEx:2,CA:FR:UPS:6"
```

Lanes are **one-directional**. Costs are non-negative integers.
Skip malformed entries (wrong number of fields, empty field, non-integer cost).

## Part 1 — direct cost
`direct_cost(data, src, dst) -> int | None` — cheapest direct lane, or `None`.

```
direct_cost(s, "US", "UK") -> 4
direct_cost(s, "US", "FR") -> None
```

## Part 2 — at most one intermediate country
`one_hop_route(data, src, dst) -> dict | None`, returning the cheapest route
using **1 or 2 lanes**:

```
one_hop_route(s, "US", "FR") ->
  {"route": "US -> UK -> FR", "method": "DHL -> DHL", "cost": 7}
```
If `src == dst` return `{"route": "US", "method": "", "cost": 0}`.

## Part 3 — any number of hops
`cheapest_route(data, src, dst) -> dict | None`, same output shape, any number
of lanes. Ties: fewer lanes wins, then the alphabetically smaller `route` string.
Must handle ~1000 countries quickly.

## Part 4 — constraints
Extend: `cheapest_route(data, src, dst, max_legs=None, carriers=None)`
- `max_legs`: maximum number of lanes allowed.
- `carriers`: a set of allowed carrier names (`None` = all).

Hint: Part 2 should become a one-liner on top of Part 4. That's the point of
these multi-part questions — design Part 1's data model so later parts reuse it.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

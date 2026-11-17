# Shipping cost

Reported in real Stripe phone screens (same shape as the "currency conversion"
question — a weighted graph hidden inside a string).

The input holds a string of shipping lanes `SRC:DST:CARRIER:COST` separated by commas:

```
US:UK:UPS:5,US:UK:DHL:4,UK:FR:DHL:3,US:CA:FedEx:2,CA:FR:UPS:6
```

Lanes are **one-directional**. Costs are non-negative integers. Ignore whitespace
around each field. Skip malformed entries (wrong number of fields, empty field,
non-integer or negative cost).

Hint: design Part 1's data model so later parts reuse it. Part 2 should become a
one-liner on top of Part 4.

## Input Format

1. The lanes string, verbatim (it may contain spaces).
2. An integer `Q`, the number of queries.
3. `Q` query lines. Each query is one of the commands described in the parts below.

```
US:UK:UPS:5,US:UK:DHL:4,UK:FR:DHL:3,US:CA:FedEx:2,CA:FR:UPS:6
2
DIRECT US UK
ONE_HOP US FR
```

## Output Format

One line per query, in order.

- `DIRECT` prints a cost.
- The other queries print a route as `ROUTE | METHOD | COST`, where `ROUTE` is the
  countries joined by ` -> `, `METHOD` is the carriers of each lane joined by ` -> `
  (or `-` when the route has no lanes), and `COST` is the total cost.
- If there is no answer, print `NONE`.

```
4
US -> UK -> FR | DHL -> DHL | 7
```

## Part 1 — Direct cost

`DIRECT SRC DST`: the cost of the cheapest direct lane from `SRC` to `DST`.

Input:
```
US:UK:UPS:5,US:UK:DHL:4,UK:FR:DHL:3,US:CA:FedEx:2,CA:FR:UPS:6
2
DIRECT US UK
DIRECT US FR
```
Output:
```
4
NONE
```

## Part 2 — At most one intermediate country

`ONE_HOP SRC DST`: the cheapest route that uses **1 or 2 lanes**.
If `SRC == DST`, the route is just `SRC`, with no lanes and cost 0.

Input:
```
US:UK:UPS:5,US:UK:DHL:4,UK:FR:DHL:3,US:CA:FedEx:2,CA:FR:UPS:6
2
ONE_HOP US FR
ONE_HOP US US
```
Output:
```
US -> UK -> FR | DHL -> DHL | 7
US | - | 0
```

## Part 3 — Any number of hops

`CHEAPEST SRC DST`: the cheapest route using any number of lanes. A route never
visits a country twice. Ties: fewer lanes wins, then the alphabetically smaller
`ROUTE` string. Must handle ~1000 countries quickly.

Input:
```
US:UK:UPS:5,US:UK:DHL:4,UK:FR:DHL:3,US:CA:FedEx:2,CA:FR:UPS:6,FR:DE:UPS:1,UK:DE:FedEx:9
1
CHEAPEST US DE
```
Output:
```
US -> UK -> FR -> DE | DHL -> DHL -> UPS | 8
```

Input:
```
A:B:X:1,B:C:X:1,A:C:Y:2
1
CHEAPEST A C
```
Output:
```
A -> C | Y | 2
```

## Part 4 — Constraints

`CHEAPEST` may be followed by options, in any order:

- `legs=N`: use at most `N` lanes.
- `carriers=A,B,...`: use only lanes of these carriers (default: all carriers).

Input:
```
US:UK:UPS:5,US:UK:DHL:4,UK:FR:DHL:3,US:CA:FedEx:2,CA:FR:UPS:6,FR:DE:UPS:1,UK:DE:FedEx:9
2
CHEAPEST US DE legs=2
CHEAPEST US DE legs=1
```
Output:
```
US -> UK -> DE | DHL -> FedEx | 13
NONE
```

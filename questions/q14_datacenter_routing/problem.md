# Datacenter request routing

Source: [FastPrep "Request Routing System"](https://www.fastprep.io/problems/stripe-request-routing-system),
reported repeatedly from 2026 Stripe HackerRank OAs as "one long question, 60 minutes".
(It's a different problem from `q5`, which routes URL paths.)

You are building a request-routing command processor for datacenters.

Each datacenter has a unique name, latitude, longitude, positive integer capacity, health
and current load. A new datacenter is **healthy with load 0**.

## Input Format

Command lines, one per line, up to the end of input. Fields are separated by one or more
spaces; spaces at the start or end of a line are ignored. Blank or all-space lines are
skipped.

```
REGISTER us-west 38 -122 100
REGISTER us-west 50 -100 50
SET_HEALTHY us-west false
```

## Output Format

One line per non-blank input line, in order: the command's result (`OK`, `ERROR`, a
distance, or a route).

```
OK
ERROR
OK
```

## Part 1 — `REGISTER` and `SET_HEALTHY`

- `REGISTER name lat lon capacity` prints `OK` and adds the datacenter if the name is
  new, lat is in `[-90, 90]`, lon is in `[-180, 180]`, and capacity is in `1..1000000000`.
  Otherwise it prints `ERROR`.
- `SET_HEALTHY name value` sets the health of an **existing** datacenter. The value is
  `true` or `false`, case-insensitive. Prints `OK`, otherwise `ERROR`. Health changes
  leave the load as it is. Names are case-sensitive.

Input:
```
REGISTER us-west 38 -122 100
REGISTER us-east 41 -74 150
REGISTER us-west 50 -100 50
REGISTER invalid-node 91 0 100
REGISTER invalid-cap 0 0 0
SET_HEALTHY us-east false
SET_HEALTHY fake-node true
```
Output:
```
OK
OK
ERROR
ERROR
ERROR
OK
ERROR
```

The errors are a duplicate name, a latitude out of range, a zero capacity and an unknown
datacenter.

## Part 2 — `DISTANCE lat1 lon1 lat2 lon2`

Print the Haversine great-circle distance, with Earth radius `6371` km, rounded to the
nearest integer (half-up). Print `ERROR` if any coordinate is out of range.

```
a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)      (φ = lat, λ = lon, in radians)
d = 2 · R · asin(√a)
```

Input:
```
DISTANCE 38 -122 41 -74
DISTANCE 0 0 0 0
DISTANCE 91 0 0 0
```
Output:
```
4080
0
ERROR
```

## Part 3 — `ROUTE lat lon`

- Candidates are all **healthy** datacenters, sorted by **exact** (unrounded) distance
  from the request point. Exact ties are broken by name, compared by character code (so
  `Z` comes before `a`).
- Pick the first candidate whose `load < capacity`, increment its load, and print
  `name rounded-distance cand1,cand2,...`. The candidate list includes full ones.
- If there are healthy candidates but all are full, print `None cand1,cand2,...`.
- If there are no healthy candidates, print exactly `None`.

Input:
```
REGISTER node-A 0 0 1
REGISTER node-B 0 0 1
REGISTER node-C 10 10 100
SET_HEALTHY node-C false
ROUTE 0 0
ROUTE 0 0
ROUTE 0 0
```
Output:
```
OK
OK
OK
OK
node-A 0 node-A,node-B
node-B 0 node-A,node-B
None node-A,node-B
```

## Part 4 — Strict input checks

A line that breaks any of these rules prints `ERROR` and **changes nothing**:
- The command name must match exactly, in uppercase. `register` and `PING` are errors.
- Each command must have exactly the right number of fields.
- A coordinate must be a plain decimal: an optional `-`, digits, then optionally `.` and
  more digits. `38`, `-74.0` and `007` are valid. `abc`, `+5`, `.5`, `5.`, `1e2` and `NaN`
  are not. Ranges are checked in **every** command, including DISTANCE and ROUTE.
- Capacity must be digits only, from 1 to 1000000000. `1.0`, `+5` and `1000000001` are errors.
- Names are any field and are case-sensitive.

Tip: Python's `float()` happily accepts `"1e2"`, `"nan"`, `"+5"` and `".5"`. Validate with
a regex such as `re.fullmatch(r"-?\d+(\.\d+)?", s)` before converting.

Input (the blank line prints nothing):
```
register a 0 0 1
REGISTER a abc 0 1
REGISTER a 0 0 1.5
REGISTER a 0 0

REGISTER a 1.5 -2 1
ROUTE 91 0
DISTANCE 0 0 0
PING
ROUTE 1.5 -2
```
Output:
```
ERROR
ERROR
ERROR
ERROR
OK
ERROR
ERROR
ERROR
a 0 a
```

# P14 — Datacenter request routing  (target: 60 min for all parts)

Source: [FastPrep "Request Routing System"](https://www.fastprep.io/problems/stripe-request-routing-system),
reported repeatedly from 2026 Stripe HackerRank OAs as "one long question, 60 minutes".
(It's a different problem from `p5`, which routes URL paths.)

You are building a request-routing command processor for datacenters.

```python
def solve(text: str) -> list[str]
```

`text` is the whole input: commands separated by newlines. Return **one output string per
non-blank line**, in order. Blank or all-space lines are skipped and produce no output.
Fields are separated by one or more spaces, and spaces at the start or end of a line are
ignored.

Each datacenter has a unique name, latitude, longitude, positive integer capacity, health
and current load. A new datacenter is **healthy with load 0**.

## Part 1 — `REGISTER` and `SET_HEALTHY`
- `REGISTER name lat lon capacity` returns `OK` and adds the datacenter if the name is
  new, lat is in `[-90, 90]`, lon is in `[-180, 180]`, and capacity is in `1..1000000000`.
  Otherwise it returns `ERROR`.
- `SET_HEALTHY name value` sets the health of an **existing** datacenter. The value is
  `true` or `false`, case-insensitive. Returns `OK`, otherwise `ERROR`. Health changes
  leave the load as it is.

```
REGISTER us-west 38 -122 100     -> OK
REGISTER us-west 50 -100 50      -> ERROR   (duplicate)
REGISTER invalid-node 91 0 100   -> ERROR   (latitude)
REGISTER invalid-cap 0 0 0       -> ERROR   (capacity)
SET_HEALTHY fake-node true       -> ERROR   (unknown)
```

## Part 2 — `DISTANCE lat1 lon1 lat2 lon2`
Return the Haversine great-circle distance, with Earth radius `6371` km, rounded to the
nearest integer (half-up). Return `ERROR` if any coordinate is invalid.

```
a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)      (φ = lat, λ = lon, in radians)
d = 2 · R · asin(√a)
DISTANCE 38 -122 41 -74 -> 4080       DISTANCE 0 0 0 0 -> 0      DISTANCE 91 0 0 0 -> ERROR
```

## Part 3 — `ROUTE lat lon`
- Candidates are all **healthy** datacenters, sorted by **exact** (unrounded) distance.
  Exact ties are broken by name, compared by character code (so `Z` comes before `a`).
- Pick the first candidate whose `load < capacity`, increment its load, and return
  `"name rounded-distance cand1,cand2,..."`. The candidate list includes full ones.
- If there are healthy candidates but all are full, return `"None cand1,cand2,..."`.
- If there are no healthy candidates, return exactly `"None"` with no trailing space.

```
REGISTER node-A 0 0 1 / REGISTER node-B 0 0 1 / REGISTER node-C 10 10 100 / SET_HEALTHY node-C false
ROUTE 0 0 -> node-A 0 node-A,node-B
ROUTE 0 0 -> node-B 0 node-A,node-B
ROUTE 0 0 -> None node-A,node-B
```

## Part 4 — strict input checks
A line that breaks any of these rules returns `ERROR` and **changes nothing**:
- The command name must match exactly, in uppercase. `register` and `PING` are errors.
- Each command must have exactly the right number of fields.
- A coordinate must be a plain decimal: an optional `-`, digits, then optionally `.` and
  more digits. `38`, `-74.0` and `007` are valid. `abc`, `+5`, `.5`, `5.`, `1e2` and `NaN`
  are not. Ranges are checked in **every** command, including DISTANCE and ROUTE.
- Capacity must be digits only, from 1 to 1000000000. `1.0`, `+5` and `1000000001` are errors.
- Names are any field and are case-sensitive.

Tip: Python's `float()` happily accepts `"1e2"`, `"nan"`, `"+5"` and `".5"`. Validate with
a regex such as `re.fullmatch(r"-?\d+(\.\d+)?", s)` before converting.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

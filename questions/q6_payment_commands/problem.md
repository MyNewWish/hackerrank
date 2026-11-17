# Payment command processor

Reported as an OA problem that "simulates a payment system" through commands.
It's a state machine with idempotency, which is very much how Stripe's API behaves.

Amounts are integers in minor units (cents). Each command produces a response:

- success: `{id} {NEW_STATE}`, e.g. `p1 AUTHORIZED`
- error: `ERROR {id} {code}`, or `ERROR - malformed` when the command can't be parsed
  (unknown verb, wrong number of arguments, currency not 3 letters).

Check errors in this order: **malformed → not_found / duplicate → invalid_transition → invalid_amount**.
A valid amount is a positive integer.

## Input Format

1. An integer `N`, the number of commands.
2. `N` command lines, tokens separated by single spaces.

```
3
CREATE p1 1000 USD
AUTHORIZE p1
AUTHORIZE p2
```

## Output Format

Each command's response on its own line, in order. Every command prints exactly
one line, except `SUMMARY` (Part 4).

```
p1 CREATED
p1 AUTHORIZED
ERROR p2 not_found
```

## Part 1 — Lifecycle

| Command | Allowed from | New state |
|---|---|---|
| `CREATE id amount CUR` | (id must be new, else `duplicate`) | CREATED |
| `AUTHORIZE id` | CREATED | AUTHORIZED |
| `CAPTURE id` | AUTHORIZED | CAPTURED (full amount) |
| `VOID id` | CREATED, AUTHORIZED | VOIDED |

An unknown id gives `not_found`. Any other transition gives `invalid_transition`. Store the
currency in upper case.

Input:
```
5
CREATE p1 1000 USD
AUTHORIZE p1
CAPTURE p1
AUTHORIZE p1
AUTHORIZE p2
```
Output:
```
p1 CREATED
p1 AUTHORIZED
p1 CAPTURED
ERROR p1 invalid_transition
ERROR p2 not_found
```

## Part 2 — Partial capture and refunds

- `CAPTURE id amount` captures up to the created amount (more gives `invalid_amount`).
- `REFUND id amount` is allowed from CAPTURED or PARTIALLY_REFUNDED. Total refunds may not
  exceed the captured amount (`invalid_amount`). The new state is `PARTIALLY_REFUNDED`,
  or `REFUNDED` once everything has been refunded.

Input:
```
6
CREATE a 1000 USD
AUTHORIZE a
CAPTURE a 600
REFUND a 200
REFUND a 500
REFUND a 400
```
Output:
```
a CREATED
a AUTHORIZED
a CAPTURED
a PARTIALLY_REFUNDED
ERROR a invalid_amount
a REFUNDED
```

## Part 3 — Idempotency keys

Any command may end with `key=XYZ`.

- First time a key is seen: execute normally and remember the response.
- Same key with the same command (compare tokens without the key): **print the stored
  response without executing again**. Errors are replayed too.
- Same key with a different command: `ERROR {id} idempotency_conflict`, where id is the
  second token. Don't store anything for this case.

Input:
```
4
CREATE a 1000 USD key=k1
CREATE a 1000 USD key=k1
AUTHORIZE a key=k2
CAPTURE a key=k2
```
Output:
```
a CREATED
a CREATED
a AUTHORIZED
ERROR a idempotency_conflict
```

## Part 4 — Summary

A line that is exactly `SUMMARY` prints the totals so far: one line per currency
of a successfully created payment, sorted by currency, as
`USD captured=600 refunded=100 net=500`. If there are no payments yet, it prints `NONE`.
Replayed commands must not be counted twice.

Input:
```
14
CREATE a 1000 USD
AUTHORIZE a
CAPTURE a 600
REFUND a 100 key=r
REFUND a 100 key=r
CREATE b 300 eur
AUTHORIZE b
CAPTURE b
CREATE c 50 USD
AUTHORIZE c
VOID c
CREATE d 70 JPY
CREATE e 5 GBPX
SUMMARY
```
Output:
```
a CREATED
a AUTHORIZED
a CAPTURED
a PARTIALLY_REFUNDED
a PARTIALLY_REFUNDED
b CREATED
b AUTHORIZED
b CAPTURED
c CREATED
c AUTHORIZED
c VOIDED
d CREATED
ERROR - malformed
EUR captured=300 refunded=0 net=300
JPY captured=0 refunded=0 net=0
USD captured=600 refunded=100 net=500
```

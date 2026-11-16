# P6 — Payment command processor  (target: 60 min for all parts)

Reported as an OA problem that "simulates a payment system" through commands.
It's a state machine with idempotency, which is very much how Stripe's API behaves.

```python
def process(commands: list[str]) -> list[str]   # exactly one output line per command
def summary(commands: list[str]) -> list[str]   # Part 4
```

Amounts are integers in minor units (cents). Output format:
- success: `"{id} {NEW_STATE}"`, e.g. `"p1 AUTHORIZED"`
- error: `"ERROR {id} {code}"`, or `"ERROR - malformed"` when the command can't be parsed
  (unknown verb, wrong number of arguments, currency not 3 letters).

Check errors in this order: **malformed → not_found / duplicate → invalid_transition → invalid_amount**.
A valid amount is a positive integer.

## Part 1 — lifecycle
| Command | Allowed from | New state |
|---|---|---|
| `CREATE id amount CUR` | (id must be new, else `duplicate`) | CREATED |
| `AUTHORIZE id` | CREATED | AUTHORIZED |
| `CAPTURE id` | AUTHORIZED | CAPTURED (full amount) |
| `VOID id` | CREATED, AUTHORIZED | VOIDED |

An unknown id gives `not_found`. Any other transition gives `invalid_transition`. Store the
currency in upper case.

## Part 2 — partial capture and refunds
- `CAPTURE id amount` captures up to the created amount (more gives `invalid_amount`).
- `REFUND id amount` is allowed from CAPTURED or PARTIALLY_REFUNDED. Total refunds may not
  exceed the captured amount (`invalid_amount`). The new state is `PARTIALLY_REFUNDED`,
  or `REFUNDED` once everything has been refunded.

## Part 3 — idempotency keys
Any command may end with `key=XYZ`.
- First time a key is seen: execute normally and remember the response.
- Same key with the same command (compare tokens without the key): **return the stored
  response without executing again**. Errors are replayed too.
- Same key with a different command: `"ERROR {id} idempotency_conflict"`, where id is the
  second token. Don't store anything for this case.

## Part 4 — `summary(commands)`
For each currency of a successfully created payment, sorted by currency:
`"USD captured=600 refunded=100 net=500"`. Replayed commands must not be counted twice.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

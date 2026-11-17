# P3 — Merchant ledger & dispute monitoring  (target: 60 min for all parts)

Modeled on reported Stripe OA problems: "transaction logs", "fraud detection with
merchant thresholds and dispute reversals", "out-of-order charge and dispute events".
This is the most Stripe-like problem in the kit — do it twice.

Input: `lines`, a list of CSV strings. First line is always the header:

```
timestamp,merchant,txn_id,type,amount,ref
100,acme,c1,CHARGE,10.00,
120,acme,r1,REFUND,3.25,c1
```

- `timestamp`: integer seconds. `amount`: decimal string with ≤ 2 decimals (may be empty for DISPUTE/REVERSAL).
- `type`: `CHARGE`, `REFUND` (ref = charge id), `DISPUTE` (ref = charge id), `REVERSAL` (ref = dispute id).
- **Skip malformed rows**: wrong field count, non-integer timestamp, bad amount
  (non-numeric, negative, more than 2 decimals), unknown type, empty merchant/txn_id.
- A reference only counts if it points to an existing event **of the same merchant**.

## Part 1 — balances
`balances(lines) -> list[str]`: net balance per merchant in the format `"acme: 12.25"`,
sorted by merchant name. CHARGE adds, REFUND subtracts (balances can go negative,
format as `"-1.00"`). Include every merchant appearing in a valid row.
**Never use float for money.**

## Part 2 — dispute rate
`flagged_merchants(lines, min_charges, max_rate) -> list[str]` (sorted):
merchants with `charges >= min_charges` and `disputes / charges >= max_rate`.
A charge can only be disputed once (extra disputes on the same charge are ignored).

## Part 3 — real-world messiness (update Parts 1 & 2, don't fork them)
1. **Out-of-order delivery**: rows aren't sorted. Process in timestamp order
   (ties: file order). A DISPUTE/REFUND whose charge has a *later* timestamp is invalid.
2. **Idempotency**: the same `txn_id` may be delivered twice. Keep only the first (by processing order).
3. **Chargebacks**: an accepted DISPUTE subtracts the charge's full amount from the balance.
4. **REVERSAL**: the merchant won the dispute — add the amount back, the dispute no
   longer counts toward Part 2, and the charge may be disputed again.

## Part 4 — burst detection
`burst_merchants(lines, window, k) -> list[str]` (sorted): merchants having at least
`k` active (non-reversed) disputes with timestamps inside some window where
`last - first < window`.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

# Merchant ledger & dispute monitoring

Modeled on reported Stripe OA problems: "transaction logs", "fraud detection with
merchant thresholds and dispute reversals", "out-of-order charge and dispute events".
This is the most Stripe-like problem in the kit — do it twice.

The input holds a list of CSV lines. The first CSV line is always the header:

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

## Input Format

1. An integer `Q`, the number of queries.
2. `Q` query lines. Each query is one of the commands described in the parts below.
3. The CSV lines, header first, up to the end of input.

```
1
BALANCES
timestamp,merchant,txn_id,type,amount,ref
100,acme,c1,CHARGE,10.00,
120,acme,r1,REFUND,3.25,c1
```

## Output Format

One line per query, in order: the query's items separated by single spaces,
or `NONE` if there are no items.

```
acme=6.75
```

## Part 1 — Balances

`BALANCES`: the net balance of every merchant appearing in a valid row, as
`merchant=amount`, sorted by merchant name. CHARGE adds, REFUND subtracts.
Balances can go negative; format them with exactly 2 decimals (`-1.00`).
**Never use float for money.**

Input:
```
1
BALANCES
timestamp,merchant,txn_id,type,amount,ref
100,acme,c1,CHARGE,10.00,
120,acme,r1,REFUND,3.25,c1
```
Output:
```
acme=6.75
```

Input:
```
1
BALANCES
timestamp,merchant,txn_id,type,amount,ref
100,acme,c1,CHARGE,10.00,
105,acme,c2,CHARGE,5.50,
110,bolt,c3,CHARGE,20.00,
120,acme,r1,REFUND,3.25,c1
130,bolt,r2,REFUND,1.00,c999
bad,row
140,bolt,c4,CHARGE,abc,
141,bolt,c6,CHARGE,1.005,
142,bolt,c7,CHARGE,-4.00,
143,bolt,c8,PAYOUT,4.00,
150,zed,c5,CHARGE,0.10,
```
Output:
```
acme=12.25 bolt=20.00 zed=0.10
```

## Part 2 — Dispute rate

`FLAGGED MIN_CHARGES MAX_RATE`: the merchants with `charges >= MIN_CHARGES` and
`disputes / charges >= MAX_RATE`, sorted by name. `MIN_CHARGES` is an integer and
`MAX_RATE` a decimal number. A charge can only be disputed once (extra disputes on
the same charge are ignored).

Input:
```
2
FLAGGED 2 0.5
FLAGGED 2 0.6
timestamp,merchant,txn_id,type,amount,ref
1,acme,c1,CHARGE,1.00,
2,acme,c2,CHARGE,1.00,
3,acme,c3,CHARGE,1.00,
4,acme,c4,CHARGE,1.00,
5,bolt,c5,CHARGE,1.00,
6,bolt,c6,CHARGE,1.00,
7,zed,c7,CHARGE,1.00,
10,acme,d1,DISPUTE,,c1
11,acme,d2,DISPUTE,,c2
12,acme,d6,DISPUTE,,c1
13,bolt,d3,DISPUTE,,c5
14,zed,d4,DISPUTE,,c7
15,acme,d5,DISPUTE,,c6
```
Output:
```
acme bolt
NONE
```

## Part 3 — Real-world messiness

Update Parts 1 and 2; don't fork them.

1. **Out-of-order delivery**: rows aren't sorted. Process in timestamp order
   (ties: file order). A DISPUTE/REFUND whose charge has a *later* timestamp is invalid.
2. **Idempotency**: the same `txn_id` may be delivered twice. Keep only the first (by processing order).
3. **Chargebacks**: an accepted DISPUTE subtracts the charge's full amount from the balance.
4. **REVERSAL**: the merchant won the dispute — add the amount back, the dispute no
   longer counts toward Part 2, and the charge may be disputed again.

Input:
```
3
BALANCES
FLAGGED 1 0.5
FLAGGED 1 0.6
timestamp,merchant,txn_id,type,amount,ref
200,acme,d1,DISPUTE,,c1
100,acme,c1,CHARGE,10.00,
100,acme,c1,CHARGE,10.00,
150,acme,c2,CHARGE,4.00,
300,acme,v1,REVERSAL,,d1
250,acme,d2,DISPUTE,,c2
```
Output:
```
acme=10.00
acme
NONE
```

The balance is 10 + 4 − 10 (d1) − 4 (d2) + 10 (v1). Only d2 is still active, so
the dispute rate is 1/2.

## Part 4 — Burst detection

`BURST WINDOW K`: the merchants, sorted by name, having at least `K` active
(non-reversed) disputes whose timestamps fit inside some window where
`last - first < WINDOW`.

Input:
```
2
BURST 100 2
BURST 101 2
timestamp,merchant,txn_id,type,amount,ref
1,acme,a1,CHARGE,1.00,
2,acme,a2,CHARGE,1.00,
3,acme,a3,CHARGE,1.00,
4,bolt,b1,CHARGE,1.00,
5,bolt,b2,CHARGE,1.00,
6,bolt,b3,CHARGE,1.00,
100,acme,da1,DISPUTE,,a1
150,acme,da2,DISPUTE,,a2
400,acme,da3,DISPUTE,,a3
100,bolt,db1,DISPUTE,,b1
200,bolt,db2,DISPUTE,,b2
120,bolt,db3,DISPUTE,,b3
130,bolt,vb3,REVERSAL,,db3
```
Output:
```
acme
acme bolt
```

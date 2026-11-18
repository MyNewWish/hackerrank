# Invoice / payment reconciliation

"Invoice / Payment Reconciliation" is one of the most-reported Stripe questions (about
21 reports). It tests money arithmetic, matching rules and allocation order.

An invoice is `ID,CUSTOMER,CURRENCY,AMOUNT,DUE_DATE`; a payment is
`ID,CUSTOMER,CURRENCY,AMOUNT,DATE,INVOICE_REF`. `INVOICE_REF` may be empty (the line then
ends with a comma). Ignore whitespace around each field. Amounts are non-negative with at
most 2 decimals; dates are `YYYY-MM-DD`. **Don't use floats for money.** Money is printed
with exactly two decimals, like `40.00`.

## Input Format

Four counted sections, each an integer count followed by that many lines:

1. **Invoices**: `ID,CUSTOMER,CURRENCY,AMOUNT,DUE_DATE`.
2. **Payments**: `ID,CUSTOMER,CURRENCY,AMOUNT,DATE,INVOICE_REF`.
3. **Rates** (Part 4; the count is `0` before that): `FROM TO RATE`.
4. **Queries**: `STATUS`, `CREDITS` or `AGING AS_OF_DATE`.

```
2
INV-1,acme,USD,100.00,2026-01-10
INV-2,acme,USD,50.00,2026-02-10
1
PAY-1,acme,USD,60.00,2026-01-05,INV-1
0
1
STATUS
```

## Output Format

For each query, in order, the lines the parts below describe. Each query works on the
full input independently (earlier queries change nothing). A `CREDITS` or `AGING` query
with no lines to print prints the single line `NONE`.

```
INV-1 PARTIAL paid=60.00 due=40.00
INV-2 OPEN paid=0.00 due=50.00
```

## Part 1 — Invoice status

In Part 1 every payment references a valid invoice of the same customer and currency,
and never overpays.

`STATUS` prints one line per invoice, sorted by id:
`ID STATUS paid=PAID due=OUTSTANDING`. `STATUS` is `OPEN` (nothing paid), `PARTIAL`, or
`PAID` (nothing outstanding).

Input:
```
4
INV-1,acme,USD,100.00,2026-01-10
INV-2,acme,USD,50.00,2026-02-10
INV-3,bolt,EUR,80.00,2026-01-20
INV-4,acme,USD,30.00,2026-01-10
3
PAY-1,acme,USD,60.00,2026-01-05,INV-1
PAY-2,bolt,EUR,80.00,2026-01-06,INV-3
PAY-3,acme,USD,50.00,2026-01-07,INV-2
0
1
STATUS
```
Output:
```
INV-1 PARTIAL paid=60.00 due=40.00
INV-2 PAID paid=50.00 due=0.00
INV-3 PAID paid=80.00 due=0.00
INV-4 OPEN paid=0.00 due=30.00
```

## Part 2 — Unreferenced payments, overpayments, credits

- Process payments in date order (ties: input order).
- A payment is **referenced** if its ref names an existing invoice of the same customer
  and currency. Otherwise it is **unreferenced** (empty ref, unknown ref, or another
  customer's invoice).
- A referenced payment pays its invoice first. Whatever is left over is handled like an
  unreferenced payment.
- An unreferenced amount pays that customer's unpaid invoices **in the same currency**,
  oldest due date first (ties: invoice id). Anything still left becomes **customer
  credit**.

`CREDITS` prints `CUSTOMER CURRENCY AMOUNT` lines, sorted by (customer, currency), for
non-zero credits only.

Input:
```
4
INV-1,acme,USD,100.00,2026-01-10
INV-2,acme,USD,50.00,2026-02-10
INV-3,bolt,EUR,80.00,2026-01-20
INV-4,acme,USD,30.00,2026-01-10
5
PAY-1,acme,USD,120.00,2026-01-05,INV-1
PAY-2,acme,USD,25.00,2026-01-06,
PAY-3,bolt,USD,10.00,2026-01-07,
PAY-4,acme,USD,100.00,2026-01-08,INV-9
PAY-5,bolt,EUR,30.00,2026-01-09,INV-1
0
2
STATUS
CREDITS
```
Output:
```
INV-1 PAID paid=100.00 due=0.00
INV-2 PAID paid=50.00 due=0.00
INV-3 PARTIAL paid=30.00 due=50.00
INV-4 PAID paid=30.00 due=0.00
acme USD 65.00
bolt USD 10.00
```

PAY-1 overpays INV-1 by 20, which goes to INV-4. PAY-2 pays INV-4's last 10, then 15 of
INV-2. PAY-3 becomes bolt's USD credit. PAY-4's ref is unknown: 35 to INV-2, 65 credit.
PAY-5 names another customer's invoice, so it pays bolt's INV-3.

## Part 3 — Aging report

`AGING AS_OF` ignores payments dated after `AS_OF`. For each (customer, currency) that
still has an outstanding balance, put each invoice's outstanding amount in a bucket by
days past due (`AS_OF - DUE_DATE`): `current` (≤ 0), `1-30`, `31-60`, `61+`. Print one
line per (customer, currency), sorted:
`CUSTOMER CURRENCY current=X 1-30=X 31-60=X 61+=X`.

Input:
```
5
A1,acme,USD,100.00,2026-03-01
A2,acme,USD,50.00,2026-02-01
A3,acme,USD,20.00,2025-12-01
A4,acme,EUR,10.00,2026-03-20
B1,bolt,USD,40.00,2026-03-10
3
P1,acme,USD,30.00,2026-03-05,A1
P2,bolt,USD,40.00,2026-03-31,B1
P3,acme,USD,5.00,2026-02-01,
0
1
AGING 2026-03-15
```
Output:
```
acme EUR current=10.00 1-30=0.00 31-60=0.00 61+=0.00
acme USD current=0.00 1-30=70.00 31-60=50.00 61+=15.00
bolt USD current=0.00 1-30=40.00 31-60=0.00 61+=0.00
```

## Part 4 — Currency conversion

A rate line `EUR USD 1.10` means 1 EUR = 1.10 USD (the inverse rate is implied). A
payment that references an invoice of the same customer **in a different currency** is
converted into the invoice's currency: multiply, then round half-up to the cent once per
payment, then apply it. Any leftover is in the invoice's currency. With no rate between
the two currencies, the payment is unreferenced, in its own currency.

Input:
```
3
U1,acme,USD,110.00,2026-01-01
U2,acme,USD,50.00,2026-01-02
E1,acme,EUR,10.00,2026-01-03
5
P1,acme,EUR,100.00,2026-01-01,U1
P2,acme,USD,11.00,2026-01-02,E1
P3,acme,EUR,10.00,2026-01-03,U2
P4,acme,GBP,5.00,2026-01-04,U2
P5,acme,USD,0.01,2026-01-05,E1
1
EUR USD 1.10
2
STATUS
CREDITS
```
Output:
```
E1 PAID paid=10.00 due=0.00
U1 PAID paid=110.00 due=0.00
U2 PARTIAL paid=11.00 due=39.00
acme EUR 0.01
acme GBP 5.00
```

P2 becomes 10.00 EUR. P4 has no GBP rate, so it is GBP credit. P5 is 0.01 / 1.10 =
0.0090909… EUR, which rounds half-up to 0.01; E1 is already paid, so it is EUR credit.

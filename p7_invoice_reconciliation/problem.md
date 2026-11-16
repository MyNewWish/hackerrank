# P7 — Invoice / payment reconciliation  (target: 60 min for all parts)

"Invoice / Payment Reconciliation" is one of the most-reported Stripe questions (about 21 reports).
It tests money arithmetic, matching rules and allocation order.

Input (no header lines):
```
invoices: "INV-1,acme,USD,100.00,2026-01-10"         id,customer,currency,amount,due_date
payments: "PAY-1,acme,USD,60.00,2026-01-05,INV-1"    id,customer,currency,amount,date,invoice_ref
```
`invoice_ref` may be empty. Amounts have at most 2 decimals. **Don't use floats for money.**
Format money as `"40.00"`.

## Part 1 — `invoice_status(invoices, payments)`
In Part 1 every payment references a valid invoice of the same customer and currency, and
never overpays. Return one line per invoice, sorted by id:
`"INV-1 PARTIAL paid=60.00 due=40.00"`. The status is `OPEN` (nothing paid), `PARTIAL`, or `PAID`.

## Part 2 — unreferenced payments, overpayments, credits
- Process payments in date order (ties: input order).
- A payment is **referenced** if its ref names an existing invoice of the same customer and
  currency. Otherwise treat it as **unreferenced** (empty ref, unknown ref, or another
  customer's invoice).
- A referenced payment pays its invoice first. Whatever is left over is handled like an
  unreferenced payment.
- An unreferenced amount pays that customer's open invoices **in the same currency**, oldest
  due date first (ties: invoice id). Anything still left becomes **customer credit**.
- `customer_credits(invoices, payments)` returns `"acme USD 65.00"` lines, sorted by
  (customer, currency), with non-zero credits only.

## Part 3 — `aging_report(invoices, payments, as_of)`
Ignore payments dated after `as_of`. For each (customer, currency) that still has an
outstanding balance, put each invoice's outstanding amount in a bucket by days past due
(`as_of - due_date`): `current` (≤ 0), `1-30`, `31-60`, `61+`. Output lines sorted by
(customer, currency):
`"acme USD current=0.00 1-30=70.00 31-60=50.00 61+=15.00"`

## Part 4 — currency conversion
Every function gains `rates=None`, a list like `["EUR USD 1.10"]` meaning 1 EUR = 1.10 USD
(the inverse rate is implied). A payment that references an invoice of the same customer
**in a different currency** is converted into the invoice's currency. Round half-up to the
cent once per payment (`Decimal.quantize(..., ROUND_HALF_UP)`), then apply it. Any leftover
is in the invoice's currency. With no rate, the payment is unreferenced, in its own currency.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

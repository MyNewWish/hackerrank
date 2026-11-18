"""Your solution - see problem.md. Run `python test.py`.

Tip: one reconcile() engine that returns (invoices, credits); the three
public functions are just different views of it.
"""

"""
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
"""

from collections import defaultdict
from dataclasses import dataclass
@dataclass
class Invoice:
    id: str
    customer: str
    currency: str
    amount: int
    due_date: str

@dataclass
class Payment:
    id: str
    customer: str
    currency: str
    amount: int
    date: str
    invoice_ref: str

    
def parse_payment(s: str)->Payment:
    id, customer, currency, s_amount, date, invoce_ref = s.split(",")
    amount = int(float(s_amount)* 100)
    return Payment(id, customer, currency, amount, date, invoce_ref)

def parse_invoice(s: str) -> Invoice:
    id, customer, currency, s_amount, due_date = s.split(",")
    amount = int(float(s_amount)* 100)
    return Invoice(id, customer, currency, amount, due_date)

def invoice_status(invoices, payments, rates=None):
    payment_ref: dict[str, list[Payment]] = defaultdict(list[Payment])

    for payment in payments:
        data = parse_payment(payment)
        payment_ref[data.invoice_ref].append(data)
    invoice_data = [parse_invoice(invoice) for invoice in invoices]
    invoice_data.sort(key=lambda x: x.id)

    
    def check(a: Invoice):
        #"INV-1 PARTIAL paid=60.00 due=40.00"`. The status is `OPEN` (nothing paid), `PARTIAL`, or `PAID`.
        paid = 0
        if a.id in payment_ref:
            for pay in payment_ref[a.id]:
               paid += pay.amount
        if paid == 0:
            status = "OPEN"
        elif paid < a.amount:
            status = "PARTIAL"
        elif paid == a.amount:
            status = "PAID"

        return f"{a.id} {status} paid={paid/100:.2f} due={(a.amount-paid)/100:.2f}" 

    return [check(a) for a in invoice_data]    


def customer_credits(invoices, payments, rates=None):
    raise NotImplementedError


def aging_report(invoices, payments, as_of, rates=None):
    raise NotImplementedError

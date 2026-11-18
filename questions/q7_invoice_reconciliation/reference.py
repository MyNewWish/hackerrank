"""Reference solution - invoice / payment reconciliation (all 4 parts).

Reads counted invoice, payment, rate and query sections from stdin; prints the
lines of each query in order.
"""
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP


@dataclass
class Invoice:
    id: str
    customer: str
    currency: str
    amount: int   # cents
    due: date
    paid: int = 0

    @property
    def outstanding(self):
        return self.amount - self.paid


def cents(s):
    return int(Decimal(s.strip()) * 100)


def fmt(c):
    sign = "-" if c < 0 else ""
    return f"{sign}{abs(c) // 100}.{abs(c) % 100:02d}"


def parse_rates(rates):
    table = {}
    for r in rates or []:
        a, b, x = r.split()
        x = Decimal(x)
        table[(a, b)] = x
        table[(b, a)] = 1 / x
    return table


def convert(amount_cents, src, dst, table):
    if src == dst:
        return amount_cents
    rate = table.get((src, dst))
    if rate is None:
        return None
    v = (Decimal(amount_cents) / 100 * rate).quantize(Decimal("0.01"), ROUND_HALF_UP)
    return int(v * 100)


def reconcile(invoices, payments, as_of=None, rates=None):
    inv = {}
    for line in invoices:
        i, cust, cur, amt, due = [x.strip() for x in line.split(",")]
        inv[i] = Invoice(i, cust, cur.upper(), cents(amt), date.fromisoformat(due))
    table = parse_rates(rates)
    credits = defaultdict(int)

    pays = []
    for idx, line in enumerate(payments):
        pid, cust, cur, amt, d, ref = [x.strip() for x in line.split(",")]
        pays.append((date.fromisoformat(d), idx, cust, cur.upper(), cents(amt), ref))
    pays.sort()

    def apply_oldest(cust, cur, amount):
        open_invs = sorted((x for x in inv.values()
                            if x.customer == cust and x.currency == cur and x.outstanding > 0),
                           key=lambda x: (x.due, x.id))
        for x in open_invs:
            if amount == 0:
                break
            take = min(amount, x.outstanding)
            x.paid += take
            amount -= take
        if amount:
            credits[(cust, cur)] += amount

    for d, _, cust, cur, amount, ref in pays:
        if as_of and d > as_of:
            continue
        target = inv.get(ref)
        if target and target.customer == cust:
            converted = convert(amount, cur, target.currency, table)
            if converted is not None:
                take = min(converted, target.outstanding)
                target.paid += take
                apply_oldest(cust, target.currency, converted - take)
                continue
        apply_oldest(cust, cur, amount)
    return inv, credits


def invoice_status(invoices, payments, rates=None):
    inv, _ = reconcile(invoices, payments, rates=rates)
    out = []
    for x in sorted(inv.values(), key=lambda x: x.id):
        status = "PAID" if x.outstanding == 0 else ("OPEN" if x.paid == 0 else "PARTIAL")
        out.append(f"{x.id} {status} paid={fmt(x.paid)} due={fmt(x.outstanding)}")
    return out


def customer_credits(invoices, payments, rates=None):
    _, credits = reconcile(invoices, payments, rates=rates)
    return [f"{c} {cur} {fmt(v)}" for (c, cur), v in sorted(credits.items()) if v]


BUCKETS = ["current", "1-30", "31-60", "61+"]


def aging_report(invoices, payments, as_of, rates=None):
    as_of = date.fromisoformat(as_of)
    inv, _ = reconcile(invoices, payments, as_of=as_of, rates=rates)
    table = defaultdict(lambda: [0, 0, 0, 0])
    for x in inv.values():
        if x.outstanding <= 0:
            continue
        days = (as_of - x.due).days
        b = 0 if days <= 0 else 1 if days <= 30 else 2 if days <= 60 else 3
        table[(x.customer, x.currency)][b] += x.outstanding
    return [f"{c} {cur} " + " ".join(f"{n}={fmt(v)}" for n, v in zip(BUCKETS, vals))
            for (c, cur), vals in sorted(table.items())]


def main():
    lines = sys.stdin.read().splitlines()
    pos = 0

    def section():
        nonlocal pos
        count = int(lines[pos]) if pos < len(lines) else 0
        items = lines[pos + 1:pos + 1 + count]
        pos += 1 + count
        return items

    invoices, payments, rates, queries = section(), section(), section(), section()
    out = []
    for query in queries:
        cmd, *args = query.split()
        if cmd == "STATUS":
            out += invoice_status(invoices, payments, rates)
        elif cmd == "CREDITS":
            out += customer_credits(invoices, payments, rates) or ["NONE"]
        elif cmd == "AGING":
            out += aging_report(invoices, payments, args[0], rates) or ["NONE"]
    print("\n".join(out))


if __name__ == "__main__":
    main()

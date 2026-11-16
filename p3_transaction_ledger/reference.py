"""Reference solution - merchant ledger & dispute monitoring (all 4 parts)."""
from collections import defaultdict, deque
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

TYPES = {"CHARGE", "REFUND", "DISPUTE", "REVERSAL"}


@dataclass
class Event:
    ts: int
    merchant: str
    txn_id: str
    type: str
    amount: int  # cents
    ref: str
    line_no: int


def to_cents(s):
    d = Decimal(s)  # raises InvalidOperation on garbage
    if d != d.quantize(Decimal("0.01")) or d < 0:
        raise ValueError(s)
    return int(d * 100)


def parse(lines):
    """Parse CSV lines (first line is a header). Skip malformed rows.
    Returns events sorted by timestamp (stable), duplicates by txn_id dropped."""
    events = []
    for i, line in enumerate(lines[1:], start=1):
        f = [x.strip() for x in line.split(",")]
        if len(f) != 6:
            continue
        ts, merchant, txn_id, typ, amount, ref = f
        typ = typ.upper()
        if typ not in TYPES or not merchant or not txn_id:
            continue
        try:
            ts = int(ts)
            cents = to_cents(amount) if amount else 0
        except (ValueError, InvalidOperation):
            continue
        events.append(Event(ts, merchant, txn_id, typ, cents, ref, i))
    events.sort(key=lambda e: (e.ts, e.line_no))
    seen, out = set(), []
    for e in events:
        if e.txn_id in seen:  # idempotency: keep first occurrence only
            continue
        seen.add(e.txn_id)
        out.append(e)
    return out


class Ledger:
    """Replays events once; every query reads from this state."""

    def __init__(self, lines):
        self.balance = defaultdict(int)
        self.charges = {}        # txn_id -> Event
        self.charge_count = defaultdict(int)
        self.disputes = {}       # dispute txn_id -> Event (only active ones)
        self.disputed_charges = set()
        for e in parse(lines):
            self._apply(e)

    def _apply(self, e):
        m = e.merchant
        self.balance[m] += 0  # merchant appears even with no money movement
        if e.type == "CHARGE":
            self.charges[e.txn_id] = e
            self.charge_count[m] += 1
            self.balance[m] += e.amount
        elif e.type == "REFUND":
            ch = self.charges.get(e.ref)
            if ch and ch.merchant == m:
                self.balance[m] -= e.amount
        elif e.type == "DISPUTE":
            ch = self.charges.get(e.ref)
            if ch and ch.merchant == m and ch.txn_id not in self.disputed_charges:
                self.disputed_charges.add(ch.txn_id)
                self.disputes[e.txn_id] = e
                self.balance[m] -= ch.amount
        elif e.type == "REVERSAL":
            d = self.disputes.get(e.ref)
            if d and d.merchant == m:
                del self.disputes[e.ref]
                self.disputed_charges.discard(d.ref)
                self.balance[m] += self.charges[d.ref].amount


def _fmt_cents(c):
    sign = "-" if c < 0 else ""
    c = abs(c)
    return f"{sign}{c // 100}.{c % 100:02d}"


# Part 1 (+ part 3 rules)
def balances(lines):
    led = Ledger(lines)
    return [f"{m}: {_fmt_cents(c)}" for m, c in sorted(led.balance.items())]


# Part 2
def flagged_merchants(lines, min_charges, max_rate):
    led = Ledger(lines)
    active = defaultdict(int)
    for d in led.disputes.values():
        active[d.merchant] += 1
    out = []
    for m, n in led.charge_count.items():
        if n >= min_charges and active[m] / n >= max_rate:
            out.append(m)
    return sorted(out)


# Part 4
def burst_merchants(lines, window, k):
    led = Ledger(lines)
    times = defaultdict(list)
    for d in led.disputes.values():
        times[d.merchant].append(d.ts)
    out = []
    for m, ts in times.items():
        ts.sort()
        q = deque()
        for t in ts:
            q.append(t)
            while t - q[0] >= window:
                q.popleft()
            if len(q) >= k:
                out.append(m)
                break
    return sorted(out)

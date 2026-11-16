"""Reference solution - payment command processor (all 4 parts)."""
from collections import defaultdict
from dataclasses import dataclass

ARGC = {"CREATE": 3, "AUTHORIZE": 1, "CAPTURE": (1, 2), "REFUND": 2, "VOID": 1}


@dataclass
class Payment:
    id: str
    amount: int
    currency: str
    state: str = "CREATED"
    captured: int = 0
    refunded: int = 0


class InvalidAmount(Exception):
    pass


def _amount(s):
    if not s.isdigit() or int(s) <= 0:
        raise InvalidAmount
    return int(s)


class Processor:
    def __init__(self):
        self.payments = {}
        self.idem = {}  # key -> (normalized command, response)

    def execute(self, line):
        tokens = line.split()
        key = None
        if tokens and tokens[-1].startswith("key="):
            key = tokens.pop()[4:]
        normalized = " ".join(tokens)
        if key:
            if key in self.idem:
                prev_cmd, prev_resp = self.idem[key]
                if prev_cmd == normalized:
                    return prev_resp
                pid = tokens[1] if len(tokens) > 1 else "-"
                return f"ERROR {pid} idempotency_conflict"
            resp = self._run(tokens)
            self.idem[key] = (normalized, resp)
            return resp
        return self._run(tokens)

    def _run(self, tokens):
        if not tokens or tokens[0].upper() not in ARGC:
            return "ERROR - malformed"
        verb, args = tokens[0].upper(), tokens[1:]
        allowed = ARGC[verb]
        allowed = allowed if isinstance(allowed, tuple) else (allowed,)
        if len(args) not in allowed:
            return "ERROR - malformed"
        pid = args[0]
        try:
            return getattr(self, "_" + verb.lower())(pid, args[1:])
        except InvalidAmount:
            return f"ERROR {pid} invalid_amount"

    def _get(self, pid):
        return self.payments.get(pid)

    def _create(self, pid, args):
        if pid in self.payments:
            return f"ERROR {pid} duplicate"
        amount = _amount(args[0])
        cur = args[1].upper()
        if len(cur) != 3 or not cur.isalpha():
            return "ERROR - malformed"
        self.payments[pid] = Payment(pid, amount, cur)
        return f"{pid} CREATED"

    def _transition(self, pid, from_states, to_state):
        p = self._get(pid)
        if p is None:
            return None, f"ERROR {pid} not_found"
        if p.state not in from_states:
            return None, f"ERROR {pid} invalid_transition"
        return p, None

    def _authorize(self, pid, args):
        p, err = self._transition(pid, {"CREATED"}, "AUTHORIZED")
        if err:
            return err
        p.state = "AUTHORIZED"
        return f"{pid} AUTHORIZED"

    def _capture(self, pid, args):
        p, err = self._transition(pid, {"AUTHORIZED"}, "CAPTURED")
        if err:
            return err
        amount = _amount(args[0]) if args else p.amount
        if amount > p.amount:
            raise InvalidAmount
        p.captured, p.state = amount, "CAPTURED"
        return f"{pid} CAPTURED"

    def _refund(self, pid, args):
        p, err = self._transition(pid, {"CAPTURED", "PARTIALLY_REFUNDED"}, None)
        if err:
            return err
        amount = _amount(args[0])
        if p.refunded + amount > p.captured:
            raise InvalidAmount
        p.refunded += amount
        p.state = "REFUNDED" if p.refunded == p.captured else "PARTIALLY_REFUNDED"
        return f"{pid} {p.state}"

    def _void(self, pid, args):
        p, err = self._transition(pid, {"CREATED", "AUTHORIZED"}, "VOIDED")
        if err:
            return err
        p.state = "VOIDED"
        return f"{pid} VOIDED"


def process(commands):
    proc = Processor()
    return [proc.execute(c) for c in commands]


def summary(commands):
    proc = Processor()
    for c in commands:
        proc.execute(c)
    totals = defaultdict(lambda: [0, 0])
    for p in proc.payments.values():
        t = totals[p.currency]
        t[0] += p.captured
        t[1] += p.refunded
    return [f"{cur} captured={c} refunded={r} net={c - r}" for cur, (c, r) in sorted(totals.items())]

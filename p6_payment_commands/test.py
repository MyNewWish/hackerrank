import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)


def check(cmds, want, fn=None):
    got = (fn or m.process)(cmds)
    rows = [f"    {c!r:32} got {g!r:36} want {w!r}" + ("" if g == w else "   <--")
            for c, g, w in zip(cmds, got + [None] * len(cmds), want)]
    if got != want:
        print(f"got {got}")
        print(f"want {want}")
    assert got == want, "\n" + "\n".join(rows)


def part1():
    check(["CREATE p1 1000 USD", "AUTHORIZE p1", "CAPTURE p1", "CREATE p1 5 USD",
           "AUTHORIZE p2", "CREATE p2 500 eur", "CAPTURE p2", "VOID p2", "AUTHORIZE p2",
           "CREATE p3 0 USD", "CREATE p4 abc USD", "FOO p1", "CREATE p5 100", "CREATE p6 1 US"],
          ["p1 CREATED", "p1 AUTHORIZED", "p1 CAPTURED", "ERROR p1 duplicate",
           "ERROR p2 not_found", "p2 CREATED", "ERROR p2 invalid_transition", "p2 VOIDED",
           "ERROR p2 invalid_transition", "ERROR p3 invalid_amount", "ERROR p4 invalid_amount",
           "ERROR - malformed", "ERROR - malformed", "ERROR - malformed"])


def part2():
    check(["CREATE a 1000 USD", "AUTHORIZE a", "CAPTURE a 600", "REFUND a 200", "REFUND a 500",
           "REFUND a 400", "REFUND a 1", "CAPTURE a 1",
           "CREATE b 100 USD", "AUTHORIZE b", "CAPTURE b 101", "CAPTURE b 0", "CAPTURE b 100",
           "REFUND b x", "CREATE c 5 USD", "REFUND c 1", "REFUND zz 1"],
          ["a CREATED", "a AUTHORIZED", "a CAPTURED", "a PARTIALLY_REFUNDED",
           "ERROR a invalid_amount", "a REFUNDED", "ERROR a invalid_transition",
           "ERROR a invalid_transition",
           "b CREATED", "b AUTHORIZED", "ERROR b invalid_amount", "ERROR b invalid_amount",
           "b CAPTURED", "ERROR b invalid_amount", "c CREATED", "ERROR c invalid_transition",
           "ERROR zz not_found"])


def part3():
    check(["CREATE a 1000 USD key=k1", "CREATE a 1000 USD key=k1", "AUTHORIZE a key=k2",
           "AUTHORIZE a key=k2", "AUTHORIZE a", "CAPTURE a 100 key=k3", "REFUND a 50 key=k3",
           "REFUND a 50 key=k4", "REFUND a 50 key=k4", "REFUND a 50",
           "CAPTURE q key=k9", "CREATE q 5 USD", "CAPTURE q key=k9"],
          ["a CREATED", "a CREATED", "a AUTHORIZED", "a AUTHORIZED",
           "ERROR a invalid_transition", "a CAPTURED", "ERROR a idempotency_conflict",
           "a PARTIALLY_REFUNDED", "a PARTIALLY_REFUNDED", "a REFUNDED",
           "ERROR q not_found", "q CREATED", "ERROR q not_found"])


def part4():
    cmds = ["CREATE a 1000 USD", "AUTHORIZE a", "CAPTURE a 600", "REFUND a 100 key=r",
            "REFUND a 100 key=r", "CREATE b 300 eur", "AUTHORIZE b", "CAPTURE b",
            "CREATE c 50 USD", "AUTHORIZE c", "VOID c", "CREATE d 70 JPY", "CREATE e 5 GBPX"]
    want = ["EUR captured=300 refunded=0 net=300", "JPY captured=0 refunded=0 net=0",
            "USD captured=600 refunded=100 net=500"]
    assert m.summary(cmds) == want, f"\n  got:  {m.summary(cmds)}\n  want: {want}"


run([part1, part2, part3, part4][2:3])

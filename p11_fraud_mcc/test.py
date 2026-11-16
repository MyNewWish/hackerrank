import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)
OK = "approved,invalid_pin"
BAD = "do_not_honor,stolen_card,lost_card"
MERCHANTS = ["acct_a,5411", "acct_b,7995", "acct_c,5411"]


def C(cid, acct, code, amount=100):
    return f"CHARGE,{cid},{acct},{amount},{code}"


def eq(got, want):
    assert got == want, f"got {got!r}, want {want!r}"


def part1():
    thr = ["5411,2", "7995,1"]
    ev = [C("c1", "acct_a", "do_not_honor"), C("c2", "acct_a", "stolen_card"),
          C("c3", "acct_b", "lost_card"), C("c4", "acct_c", "approved"),
          C("c5", "acct_a", "approved"), C("c6", "acct_b", "approved"),
          C("c7", "acct_c", "stolen_card"), C("c8", "acct_c", "weird_code"),
          C("c9", "acct_z", "stolen_card"), C("c7", "acct_c", "stolen_card")]  # dup id
    eq(m.fraud_by_count(OK, BAD, thr, MERCHANTS, 3, ev), "acct_a")
    eq(m.fraud_by_count(OK, BAD, thr, MERCHANTS, 2, ev), "acct_a,acct_b")
    eq(m.fraud_by_count(OK, BAD, thr, MERCHANTS, 10, ev), "")


THR2 = ["5411,0.5", "7995,0.25"]
EV2 = [C("c1", "acct_a", "approved"), C("c2", "acct_a", "stolen_card"),     # 1/2 -> marked
       C("c3", "acct_a", "approved"), C("c4", "acct_a", "approved"),        # 1/4 but sticky
       C("c5", "acct_b", "approved"), C("c6", "acct_b", "approved"),
       C("c7", "acct_b", "approved"), C("c8", "acct_b", "lost_card"),       # 1/4 >= 0.25
       C("c9", "acct_c", "approved"), C("c10", "acct_c", "approved"),
       C("c11", "acct_c", "stolen_card")]                                    # 1/3 < 0.5


def part2():
    eq(m.fraud_by_percent(OK, BAD, THR2, MERCHANTS, 2, EV2), "acct_a,acct_b")
    eq(m.fraud_by_percent(OK, BAD, THR2, MERCHANTS, 5, EV2), "")
    # exact comparison: 3/10 >= 0.3 must be true
    ev = [C(f"x{i}", "acct_c", "stolen_card" if i < 3 else "approved") for i in range(10)][::-1]
    eq(m.fraud_by_percent(OK, BAD, ["5411,0.3"], MERCHANTS, 10, ev), "acct_c")


def part3():
    ev = EV2 + ["DISPUTE,c2", "DISPUTE,c5", "DISPUTE,nope", C("c12", "acct_a", "do_not_honor")]
    eq(m.fraud_by_percent(OK, BAD, THR2, MERCHANTS, 2, ev), "acct_b")
    ev2 = [C("d1", "acct_a", "stolen_card"), C("d2", "acct_a", "approved"),   # 1/2 marked
           "DISPUTE,d1",                                                      # 0/2 cleared
           C("d3", "acct_a", "stolen_card"),                                  # 1/3 no
           "DISPUTE,d1",                                                      # dup: ignored
           C("d4", "acct_a", "stolen_card")]                                  # 2/4 marked
    eq(m.fraud_by_percent(OK, BAD, THR2, MERCHANTS, 2, ev2), "acct_a")
    eq(m.fraud_by_percent(OK, BAD, THR2, MERCHANTS, 2, ev2[:3]), "")


run([part1, part2, part3])

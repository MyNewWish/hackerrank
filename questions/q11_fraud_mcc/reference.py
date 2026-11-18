"""Reference solution - Catch Me If You Can (all 3 parts).

Reads the code lists, the mode line and the counted threshold, merchant and event
sections from stdin; prints the sorted fraudulent account ids, or NONE.
"""
import sys
from fractions import Fraction


def _codes(s):
    return {c.strip() for c in s.split(",") if c.strip()}


def _run(non_fraud, fraud, thresholds, merchants, min_txns, events, as_fraction):
    ok_codes, bad_codes = _codes(non_fraud), _codes(fraud)
    thr = {}
    for line in thresholds:
        mcc, t = [x.strip() for x in line.split(",")]
        thr[mcc] = Fraction(t) if as_fraction else int(t)
    mcc_of = {}
    for line in merchants:
        acct, mcc = [x.strip() for x in line.split(",")]
        mcc_of[acct] = mcc

    total, bad, marked = {}, {}, set()
    charges = {}        # charge_id -> [account, is_fraud]
    disputed = set()

    def breaches(acct):
        if total[acct] < min_txns:
            return False
        t = thr[mcc_of[acct]]
        return Fraction(bad[acct], total[acct]) >= t if as_fraction else bad[acct] >= t

    for line in events:
        f = [x.strip() for x in line.split(",")]
        if f[0] == "CHARGE" and len(f) == 5:
            _, cid, acct, _amount, code = f
            if acct not in mcc_of or mcc_of[acct] not in thr or cid in charges:
                continue
            if code not in ok_codes and code not in bad_codes:
                continue
            is_bad = code in bad_codes
            charges[cid] = [acct, is_bad]
            total[acct] = total.get(acct, 0) + 1
            bad[acct] = bad.get(acct, 0) + is_bad
            if breaches(acct):
                marked.add(acct)            # sticky: more good charges never un-mark
        elif f[0] == "DISPUTE" and len(f) == 2:
            cid = f[1]
            if cid not in charges or cid in disputed:
                continue
            disputed.add(cid)
            acct, is_bad = charges[cid]
            if is_bad:
                charges[cid][1] = False
                bad[acct] -= 1
            if acct in marked and not breaches(acct):
                marked.discard(acct)        # a dispute can clear the flag
    return ",".join(sorted(marked)) or "NONE"


def main():
    lines = sys.stdin.read().splitlines()
    non_fraud, fraud = lines[0], lines[1]
    mode, min_txns = lines[2].split()
    pos = 3

    def section():
        nonlocal pos
        count = int(lines[pos])
        items = lines[pos + 1:pos + 1 + count]
        pos += 1 + count
        return items

    thresholds, merchants, events = section(), section(), section()
    print(_run(non_fraud, fraud, thresholds, merchants, int(min_txns), events, mode == "PERCENT"))


if __name__ == "__main__":
    main()

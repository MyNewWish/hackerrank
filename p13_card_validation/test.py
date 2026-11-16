import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)


def eq(got, want, label=""):
    assert got == want, f"{label}\n  got:  {got!r}\n  want: {want!r}"


def part1():
    eq(m.validate_visa("4532015112830366"), "VISA")
    eq(m.validate_visa("4242424242424242"), "VISA")
    eq(m.validate_visa("4242424242424243"), "INVALID_CHECKSUM")
    eq(m.validate_visa("4425233430109994"), "INVALID_CHECKSUM", "(the source page is wrong here)")


def part2():
    cases = {"4242424242424242": "VISA", "378282246310005": "AMEX", "5555555555554444": "MASTERCARD",
             "5555555555554445": "INVALID_CHECKSUM", "4425233430109994": "INVALID_CHECKSUM",
             "5482334509943": "UNKNOWN_NETWORK", "562523343010901": "UNKNOWN_NETWORK",
             "5655555555554444": "UNKNOWN_NETWORK", "4111x11111111111": "UNKNOWN_NETWORK",
             "424242424242424": "UNKNOWN_NETWORK", "": "UNKNOWN_NETWORK"}
    for card, want in cases.items():
        eq(m.classify(card), want, f"classify({card!r})")


def part3():
    eq(m.count_redacted("4242424242424*42"), ["VISA,1"])
    eq(m.count_redacted("3*8282246310005"), ["AMEX,1"])
    eq(m.count_redacted("3**282246310005"), ["AMEX,2"])
    eq(m.count_redacted("**55555555554444"), ["MASTERCARD,1", "VISA,1"])
    eq(m.count_redacted("4*4*424242424242"), ["VISA,10"])
    eq(m.count_redacted("9*00000000000000"), [])
    t0 = time.perf_counter()
    eq(m.count_redacted("42424*****424242"), ["VISA,10000"])
    assert time.perf_counter() - t0 < 3, "5 stars should finish in a few seconds"


def part4():
    got = m.recover("378282246310050?")   # true card 378282246310005 with last two swapped
    eq(got, ['372282246310050,AMEX', '378222246310050,AMEX', '378282216310050,AMEX',
             '378282240310050,AMEX', '378282243610050,AMEX', '378282246010050,AMEX',
             '378282246310005,AMEX', '378282246310054,AMEX', '378282246310070,AMEX',
             '378282246310450,AMEX', '378282246310500,AMEX', '378282246312050,AMEX',
             '378282246350050,AMEX', '378282646310050,AMEX', '378284246310050,AMEX',
             '378482246310050,AMEX'])
    got = m.recover("4242424242424241?")  # last digit changed
    assert "4242424242424242,VISA" in got and len(got) == 15, got
    got = m.recover("4242424242424242?")  # already valid: input itself is not a candidate
    assert "4242424242424242,VISA" not in got
    assert got == sorted(got, key=lambda x: int(x.split(",")[0])), "sort numerically"
    assert len(got) == len(set(got)), "deduplicate"


run([part1, part2, part3, part4])

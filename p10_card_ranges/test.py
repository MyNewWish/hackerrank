import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)


def check(got, want):
    assert got == want, "\n  got:  " + "\n        ".join(got) + "\n  want: " + "\n        ".join(want)


def part1():
    check(m.obfuscate("424242", ["0000000000,4999999999,VISA", "5000000000,9999999999,VISA_DEBIT"]),
          ["4242420000000000,4242424999999999,VISA", "4242425000000000,4242429999999999,VISA_DEBIT"])
    check(m.obfuscate("400000", ["0,9,A", "10,9999999999,B"]),
          ["4000000000000000,4000000000000009,A", "4000000000000010,4000009999999999,B"])
    text = "777777\n2\n0000000000,3999999999,VISA\n4000000000,9999999999,MASTERCARD\n"
    assert m.solve(text) == ("7777770000000000,7777773999999999,VISA\n"
                             "7777774000000000,7777779999999999,MASTERCARD"), m.solve(text)


def part2():
    check(m.obfuscate("777777", ["4000000000,5999999999,MASTERCARD", "1000000000,3999999999,VISA"]),
          ["7777770000000000,7777773999999999,VISA", "7777774000000000,7777779999999999,MASTERCARD"])
    check(m.obfuscate("111111", ["0000000000,0999999999,A", "2000000000,9999999999,B"]),
          ["1111110000000000,1111111999999999,A", "1111112000000000,1111119999999999,B"])
    check(m.obfuscate("222222", ["5,10,X"]), ["2222220000000000,2222229999999999,X"])
    check(m.obfuscate("222222", ["bad", "1,2", "9,3,X", "x,5,Y"]), [])
    text = "777777\n2\n1000000000,3999999999,VISA\n4000000000,5999999999,MASTERCARD"
    assert m.solve(text) == ("7777770000000000,7777773999999999,VISA\n"
                             "7777774000000000,7777779999999999,MASTERCARD"), m.solve(text)


def part3():
    check(m.obfuscate("333333", ["0000000000,1999999999,VISA", "3000000000,4999999999,VISA",
                                 "5000000000,9999999999,MC"]),
          ["3333330000000000,3333334999999999,VISA", "3333335000000000,3333339999999999,MC"])
    check(m.obfuscate("333333", ["0,1,A", "2,3,B", "4,5,A", "6,7,A"]),
          ["3333330000000000,3333330000000001,A", "3333330000000002,3333330000000003,B",
           "3333330000000004,3333339999999999,A"])


run([part1, part2, part3])

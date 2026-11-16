import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)


def check(lines, want):
    text = "\n".join(lines)
    got = m.solve(text)
    assert isinstance(got, list), f"solve() must return a list of strings, got {type(got).__name__}"
    cmds = [l for l in lines if l.strip()]
    rows = [f"    {c!r:36} got {g!r:34} want {w!r}" + ("" if g == w else "   <--")
            for c, g, w in zip(cmds, got + [None] * len(want), want)]
    assert got == want, f"\n  (got {len(got)} outputs, want {len(want)})\n" + "\n".join(rows)


def part1():
    # page example 1
    check(["REGISTER us-west 38 -122 100", "REGISTER us-east 41 -74 150", "REGISTER us-west 50 -100 50",
           "REGISTER invalid-node 91 0 100", "REGISTER invalid-cap 0 0 0",
           "SET_HEALTHY us-east false", "SET_HEALTHY fake-node true"],
          ["OK", "OK", "ERROR", "ERROR", "ERROR", "OK", "ERROR"])
    # page example 5
    check(["REGISTER us-west 38 -122 100", "REGISTER us-east 41 -74 150", "REGISTER eu-west 52 0 200",
           "SET_HEALTHY us-east false", "REGISTER us-west 50 -100 50", "REGISTER invalid 91 0 100",
           "REGISTER invalid2 0 0 0"],
          ["OK", "OK", "OK", "OK", "ERROR", "ERROR", "ERROR"])
    check(["REGISTER a -90 180 1", "REGISTER b 90 -180 1", "REGISTER c 0 180.5 1",
           "SET_HEALTHY a TRUE", "SET_HEALTHY a False", "SET_HEALTHY a yes", "SET_HEALTHY A true"],
          ["OK", "OK", "ERROR", "OK", "OK", "ERROR", "ERROR"])


def part2():
    # page example 2
    check(["DISTANCE 38 -122 41 -74", "DISTANCE 0 0 0 0", "DISTANCE 91 0 0 0"], ["4080", "0", "ERROR"])
    check(["DISTANCE 0 0 0 180", "DISTANCE 51.5 -0.13 40.71 -74.01", "DISTANCE -33.87 151.21 35.68 139.69",
           "DISTANCE 41 -74 38 -122", "DISTANCE 0 -181 0 0"],
          ["20015", "5571", "7826", "4080", "ERROR"])


def part3():
    # page example 3
    check(["REGISTER node-A 0 0 1", "REGISTER node-B 0 0 1", "REGISTER node-C 10 10 100",
           "SET_HEALTHY node-C false", "ROUTE 0 0", "ROUTE 0 0", "ROUTE 0 0"],
          ["OK", "OK", "OK", "OK", "node-A 0 node-A,node-B", "node-B 0 node-A,node-B", "None node-A,node-B"])
    # source note scenario: nearest fills up, overflow goes to the next one
    check(["REGISTER us-west 38 -122 2", "REGISTER us-east 41 -74 100",
           "ROUTE 38 -122", "ROUTE 38 -122", "ROUTE 38 -122", "ROUTE 40 -100"],
          ["OK", "OK", "us-west 0 us-west,us-east", "us-west 0 us-west,us-east",
           "us-east 4080 us-west,us-east", "us-east 2193 us-west,us-east"])
    check(["ROUTE 0 0", "REGISTER x 0 0 5", "SET_HEALTHY x false", "ROUTE 0 0",
           "SET_HEALTHY x true", "ROUTE 0 0"],
          ["None", "OK", "OK", "None", "OK", "x 0 x"])
    # exact tie -> name by character code: 'Z' < 'a'
    check(["REGISTER a 1 1 5", "REGISTER Z 1 1 5", "ROUTE 1 1"], ["OK", "OK", "Z 0 Z,a"])
    # health flip keeps load: b is full even after going down and up again
    check(["REGISTER b 0 0 1", "REGISTER c 5 5 9", "ROUTE 0 0", "SET_HEALTHY b false",
           "SET_HEALTHY b true", "ROUTE 0 0"],
          ["OK", "OK", "b 0 b,c", "OK", "OK", "c 786 b,c"])


def part4():
    # page example 4 (blank line produces no output)
    check(["register a 0 0 1", "REGISTER a abc 0 1", "REGISTER a 0 0 1.5", "REGISTER a 0 0", "",
           "REGISTER a 1.5 -2 1", "ROUTE 91 0", "DISTANCE 0 0 0", "PING", "ROUTE 1.5 -2"],
          ["ERROR", "ERROR", "ERROR", "ERROR", "OK", "ERROR", "ERROR", "ERROR", "a 0 a"])
    bad_nums = ["+5", ".5", "5.", "1e2", "NaN", "nan", "inf", "--1", "1.2.3", "0x1"]
    check([f"DISTANCE {b} 0 0 0" for b in bad_nums], ["ERROR"] * len(bad_nums))
    check(["REGISTER p 007 -074.50 3", "REGISTER q 0 0 1000000000", "REGISTER r 0 0 1000000001",
           "REGISTER s 0 0 +5", "REGISTER t 0 0 1.0", "REGISTER u 0 0 -1",
           "   REGISTER   v   1   1   7   ", "   ", "ROUTE 0 0 extra", "ROUTE 7 -74.5", "ROUTE -0 -0"],
          ["OK", "OK", "ERROR", "ERROR", "ERROR", "ERROR", "OK", "ERROR",
           "p 0 p,q,v", "q 0 q,v,p"])
    # an ERROR line must not change state: failed register doesn't reserve the name
    check(["REGISTER w 99 0 1", "REGISTER w 1 1 1", "ROUTE 1 1"], ["ERROR", "OK", "w 0 w"])


run([part1, part2, part3, part4])

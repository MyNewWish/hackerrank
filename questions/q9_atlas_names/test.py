import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)
A, N = "Name Available", "Name Not Available"


def check(reqs, got, want):
    rows = [f"    {r!r:28} got {g!r:30} want {w!r}" + ("" if g == w else "   <--")
            for r, g, w in zip(reqs, got + [None] * len(want), want)]
    assert got == want, "\n" + "\n".join(rows)


def part1():
    reqs = ["a1|Stripe Inc.", "a2|stripe", "a3|The Stripe LLC", "a4|Acme & Co", "a5|Acme and Co, LLC.",
            "a6|And Partners", "a7|Partners", "a8|The", "a9|  Big   Data  ", "a10|big data corp.",
            "a11|A Team", "a12|Team", "a13|Theory", "no pipe here", "a14|L.L.C."]
    want = [f"a1|{A}", f"a2|{N}", f"a3|{N}", f"a4|{A}", f"a5|{N}", f"a6|{A}", f"a7|{A}", f"a8|{N}",
            f"a9|{A}", f"a10|{N}", f"a11|{A}", f"a12|{N}", f"a13|{A}", f"a14|{N}"]
    check(reqs, m.check_names(reqs), want)


def part2():
    assert m.normalize("The Foo & Bar, Inc.") == "foo bar"
    assert m.normalize("And  and AND") == "and"
    reg = m.NameRegistry()
    assert reg.process(["x|Foo Inc."]) == [f"x|{A}"]
    assert reg.process(["y|foo"]) == [f"y|{N}"], "registrations must persist across batches"
    assert m.NameRegistry().process(["y|foo"]) == [f"y|{A}"], "instances must be independent"


def part3():
    reqs = ["a|Foo LLC", "b|foo", "RECLAIM,b,foo", "RECLAIM,a,Foo", "RECLAIM,a, Foo LLC ",
            "b|foo", "RECLAIM,a,Foo LLC", "RECLAIM,b,foo", "c|The Foo"]
    want = [f"a|{A}", f"b|{N}", "b|Reclaim Denied", "a|Reclaim Denied", "a|Reclaimed",
            f"b|{A}", "a|Reclaim Denied", "b|Reclaimed", f"c|{A}"]
    check(reqs, m.NameRegistry().process(reqs), want)


run([part1, part2, part3])

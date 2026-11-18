import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)


def eq(got, want, label=""):
    assert got == want, f"{label} got {got!r}, want {want!r}"


def part1():
    eq([m.compute_penalty("Y Y N Y", t) for t in range(5)], [3, 2, 1, 2, 1])
    eq(m.compute_penalty("", 0), 0)
    eq(m.compute_penalty("N N", 2), 2)
    eq(m.compute_penalty("Y  N\tY", 1), 1, "any whitespace separates tokens:")
    eq(m.compute_penalty("Y N", 3), -1)
    eq(m.compute_penalty("Y N", -1), -1)


def part2():
    eq(m.find_best_closing_time("Y Y N Y"), 2, "tie between 2 and 4 -> smallest:")
    eq(m.find_best_closing_time("N N N"), 0)
    eq(m.find_best_closing_time("Y Y Y"), 3)
    eq(m.find_best_closing_time(""), 0)
    rnd = random.Random(7)
    for _ in range(200):
        log = " ".join(rnd.choice("YN") for _ in range(rnd.randint(0, 12)))
        n = len(log.split())
        pens = [log.split()[:t].count("N") + log.split()[t:].count("Y") for t in range(n + 1)]
        eq(m.find_best_closing_time(log), pens.index(min(pens)), f"log {log!r}:")
    big = " ".join(rnd.choice("YN") for _ in range(200_000))
    t0 = time.perf_counter()
    m.find_best_closing_time(big)
    assert time.perf_counter() - t0 < 1.0, "too slow - use a running penalty, not O(n^2)"


def part3():
    eq(m.get_best_closing_times("BEGIN Y Y N Y END"), [2])
    eq(m.get_best_closing_times("BEGIN Y END BEGIN N END"), [1, 0])
    eq(m.get_best_closing_times("BEGIN Y\nY END\nBEGIN BEGIN N N END Y END BEGIN Y"), [2, 0])
    eq(m.get_best_closing_times("BEGIN Y X END"), [])
    eq(m.get_best_closing_times("BEGIN END"), [0])
    eq(m.get_best_closing_times("END Y BEGIN N END"), [0])
    eq(m.get_best_closing_times(""), [])


run([part1, part2, part3])

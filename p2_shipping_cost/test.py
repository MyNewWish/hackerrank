import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)

S = ("US:UK:UPS:5,US:UK:DHL:4,UK:FR:DHL:3,US:CA:FedEx:2,CA:FR:UPS:6,"
     "FR:DE:UPS:1,UK:DE:FedEx:9")


def R(route, method, cost):
    return {"route": route, "method": method, "cost": cost}


def part1():
    assert m.direct_cost(S, "US", "UK") == 4
    assert m.direct_cost(S, "UK", "FR") == 3
    assert m.direct_cost(S, "US", "FR") is None
    assert m.direct_cost(S, "UK", "US") is None, "lanes are one-directional"
    bad = "US:XX:UPS,US:JP:DHL:abc,,US:JP:UPS:7, US : MX : DHL : 3 "
    assert m.direct_cost(bad, "US", "JP") == 7
    assert m.direct_cost(bad, "US", "MX") == 3, "trim whitespace"


def part2():
    assert m.one_hop_route(S, "US", "FR") == R("US -> UK -> FR", "DHL -> DHL", 7)
    assert m.one_hop_route(S, "US", "UK") == R("US -> UK", "DHL", 4)
    assert m.one_hop_route(S, "US", "DE") == R("US -> UK -> DE", "DHL -> FedEx", 13)
    assert m.one_hop_route(S, "DE", "US") is None
    assert m.one_hop_route(S, "US", "US") == R("US", "", 0)


def part3():
    assert m.cheapest_route(S, "US", "DE") == R("US -> UK -> FR -> DE", "DHL -> DHL -> UPS", 8)
    assert m.cheapest_route("A:B:X:1,B:C:X:1,A:C:Y:2", "A", "C") == R("A -> C", "Y", 2)
    assert m.cheapest_route("A:B:X:1,B:A:X:1", "A", "C") is None
    # scale: 1000-node chain with skip edges
    n = 1000
    lanes = []
    for i in range(n - 1):
        lanes.append(f"N{i}:N{i + 1}:X:2")
        if i + 2 < n:
            lanes.append(f"N{i}:N{i + 2}:Y:3")
    big = ",".join(lanes)
    r = m.cheapest_route(big, "N0", f"N{n - 1}")
    assert r is not None and r["cost"] == 3 * ((n - 1) // 2) + 2 * ((n - 1) % 2), r and r["cost"]


def part4():
    assert m.cheapest_route(S, "US", "DE", max_legs=2) == R("US -> UK -> DE", "DHL -> FedEx", 13)
    assert m.cheapest_route(S, "US", "DE", max_legs=1) is None
    assert m.cheapest_route(S, "US", "DE", carriers={"UPS", "FedEx"}) == \
        R("US -> CA -> FR -> DE", "FedEx -> UPS -> UPS", 9)
    assert m.cheapest_route(S, "US", "DE", carriers={"DHL"}) is None


run([part1, part2, part3, part4])

"""Reference solution - datacenter request routing (all 4 parts).

Reads command lines from stdin up to the end of input; prints one line per non-blank line.
"""
import math
import re
import sys
from dataclasses import dataclass

NUM = re.compile(r"-?\d+(\.\d+)?")
CAP = re.compile(r"\d+")
EARTH_KM = 6371


@dataclass
class DC:
    name: str
    lat: float
    lon: float
    capacity: int
    healthy: bool = True
    load: int = 0


def parse_coord(s, limit):
    if not NUM.fullmatch(s):
        return None
    v = float(s)
    return v if -limit <= v <= limit else None


def parse_point(lat_s, lon_s):
    lat, lon = parse_coord(lat_s, 90), parse_coord(lon_s, 180)
    return None if lat is None or lon is None else (lat, lon)


def haversine(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_KM * math.asin(min(1.0, math.sqrt(a)))


def rounded(d):
    return str(int(math.floor(d + 0.5)))     # half-up; d is never negative


class Router:
    def __init__(self):
        self.dcs = {}

    def run(self, line):
        f = line.split()
        cmd, args = f[0], f[1:]
        handler = {"REGISTER": (self.register, 4), "SET_HEALTHY": (self.set_healthy, 2),
                   "DISTANCE": (self.distance, 4), "ROUTE": (self.route, 2)}.get(cmd)
        if handler is None or len(args) != handler[1]:
            return "ERROR"
        return handler[0](*args)

    def register(self, name, lat_s, lon_s, cap_s):
        pt = parse_point(lat_s, lon_s)
        if name in self.dcs or pt is None or not CAP.fullmatch(cap_s):
            return "ERROR"
        cap = int(cap_s)
        if not 1 <= cap <= 1_000_000_000:
            return "ERROR"
        self.dcs[name] = DC(name, pt[0], pt[1], cap)
        return "OK"

    def set_healthy(self, name, value):
        v = value.lower()
        if name not in self.dcs or v not in ("true", "false"):
            return "ERROR"
        self.dcs[name].healthy = v == "true"
        return "OK"

    def distance(self, a, b, c, d):
        p, q = parse_point(a, b), parse_point(c, d)
        if p is None or q is None:
            return "ERROR"
        return rounded(haversine(*p, *q))

    def route(self, lat_s, lon_s):
        pt = parse_point(lat_s, lon_s)
        if pt is None:
            return "ERROR"
        ranked = sorted((haversine(*pt, dc.lat, dc.lon), dc.name, dc)
                        for dc in self.dcs.values() if dc.healthy)
        if not ranked:
            return "None"
        names = ",".join(n for _, n, _ in ranked)
        for dist, name, dc in ranked:
            if dc.load < dc.capacity:
                dc.load += 1
                return f"{name} {rounded(dist)} {names}"
        return f"None {names}"


def solve(text):
    router = Router()
    return [router.run(line) for line in text.split("\n") if line.strip()]


def main():
    for result in solve(sys.stdin.read()):
        print(result)


if __name__ == "__main__":
    main()

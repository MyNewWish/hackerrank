"""Reference solution - request router (all 4 parts).

Reads the counted rules and the counted request/health lines from stdin; prints one line per request.
"""
import sys
from dataclasses import dataclass, field


@dataclass
class Rule:
    method: str
    segs: list
    backends: list          # expanded by weight: a:3,b:1 -> [a, a, a, b]
    order: int
    cursor: int = 0


def _split_path(path):
    path = path.split("?", 1)[0]
    return [s for s in path.strip().split("/") if s]


def parse_rule(text, order):
    left, sep, right = text.partition("->")
    if not sep:
        return None
    parts = left.split()
    if len(parts) != 2:
        return None
    method, path = parts
    backends = []
    for b in right.split(","):
        name, _, w = b.strip().partition(":")
        if not name:
            continue
        try:
            weight = int(w) if w else 1
        except ValueError:
            continue
        backends += [name] * max(weight, 0)
    if not backends:
        return None
    segs = _split_path(path)
    if "*" in segs[:-1]:            # wildcard only allowed at the end
        return None
    return Rule(method.upper(), segs, backends, order)


def score(rule, method, segs):
    """Specificity tuple (bigger = better) or None if no match.
    per segment: literal 3, :param 2; trailing * -> 0; exact-length end marker 1."""

    if rule.method not in ("*", method):
        return None
    ranks = []
    for i, p in enumerate(rule.segs):
        if p == "*":
            ranks.append(0)
            break
        if i >= len(segs):
            return None
        if p.startswith(":"):
            ranks.append(2)
        elif p == segs[i]:
            ranks.append(3)
        else:
            return None
    else:
        if len(rule.segs) != len(segs):
            return None
        ranks.append(1)
    return (tuple(ranks), rule.method != "*", -rule.order)


class Router:
    def __init__(self, rules):
        self.rules = [r for i, t in enumerate(rules) if (r := parse_rule(t, i))]
        self.down = set()

    def match(self, method, path):
        segs = _split_path(path)
        best, best_score = None, None
        for r in self.rules:
            s = score(r, method, segs)
            if s is not None and (best_score is None or s > best_score):
                best, best_score = r, s
        return best

    def pick(self, rule):
        n = len(rule.backends)
        for step in range(n):
            i = (rule.cursor + step) % n
            if rule.backends[i] not in self.down:
                rule.cursor = (i + 1) % n
                return rule.backends[i]
        return "503"

    def handle(self, line):
        parts = line.split()
        if len(parts) != 2:
            return None
        cmd, arg = parts[0].upper(), parts[1]
        if cmd == "DOWN":
            self.down.add(arg)
            return None
        if cmd == "UP":
            self.down.discard(arg)
            return None
        rule = self.match(cmd, arg)
        return self.pick(rule) if rule else "404"


def route(rules, lines):
    router = Router(rules)
    out = []
    for line in lines:
        r = router.handle(line)
        if r is not None:
            out.append(r)
    return out


def main():
    lines = sys.stdin.read().splitlines()
    rule_count = int(lines[0])
    rules = lines[1:1 + rule_count]
    line_count = int(lines[1 + rule_count])
    events = lines[2 + rule_count:2 + rule_count + line_count]
    for result in route(rules, events):
        print(result)


if __name__ == "__main__":
    main()

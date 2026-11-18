"""Reference solution - payment card validation (all 4 parts).

Reads Q queries (VISA / CLASSIFY / REDACTED / RECOVER card) from stdin; prints one line per query.
"""
import sys
from collections import Counter
from itertools import product


def luhn_ok(digits):
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = ord(ch) - 48
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def network(digits):
    n = len(digits)
    if n == 16 and digits[0] == "4":
        return "VISA"
    if n == 16 and "51" <= digits[:2] <= "55":
        return "MASTERCARD"
    if n == 15 and digits[:2] in ("34", "37"):
        return "AMEX"
    return None


# Part 1
def validate_visa(card):
    return "VISA" if luhn_ok(card) else "INVALID_CHECKSUM"


# Part 2
def classify(card):
    if not card.isdigit():
        return "UNKNOWN_NETWORK"
    net = network(card)
    if net is None:
        return "UNKNOWN_NETWORK"
    return net if luhn_ok(card) else "INVALID_CHECKSUM"


# Part 3
def count_redacted(card):
    holes = [i for i, c in enumerate(card) if c == "*"]
    chars = list(card)
    counts = Counter()
    # the network only depends on length + first two chars: prune early if possible
    for fill in product("0123456789", repeat=len(holes)):
        for i, d in zip(holes, fill):
            chars[i] = d
        s = "".join(chars)
        net = network(s)
        if net and luhn_ok(s):
            counts[net] += 1
    return [f"{net},{c}" for net, c in sorted(counts.items())]


# Part 4
def recover(card):
    s = card.rstrip("?")
    cands = set()
    for i, c in enumerate(s):
        for d in "0123456789":
            if d != c:
                cands.add(s[:i] + d + s[i + 1:])
    for i in range(len(s) - 1):
        if s[i] != s[i + 1]:
            cands.add(s[:i] + s[i + 1] + s[i] + s[i + 2:])
    out = []
    for c in cands:
        net = network(c)
        if net and luhn_ok(c):
            out.append((int(c), f"{c},{net}"))
    return [line for _, line in sorted(out)]


COMMANDS = {
    "VISA": lambda card: [validate_visa(card)],
    "CLASSIFY": lambda card: [classify(card)],
    "REDACTED": count_redacted,
    "RECOVER": recover,
}


def main():
    lines = sys.stdin.read().splitlines()
    for line in lines[1:1 + int(lines[0])]:
        cmd, _, card = line.strip().partition(" ")
        print(" ".join(COMMANDS[cmd](card.strip())) or "NONE")


if __name__ == "__main__":
    main()

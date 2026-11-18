"""Reference solution - BIN range obfuscation (all 3 parts).

Reads the BIN, an interval count and the interval lines from stdin; prints one
16-digit interval per line, or NONE.
"""
import sys

MAX = 10**10 - 1


def obfuscate(bin6, intervals):
    rows = []
    for line in intervals:
        parts = [p.strip() for p in line.split(",")]
        if len(parts) != 3:
            continue
        try:
            s, e = int(parts[0]), int(parts[1])
        except ValueError:
            continue
        if 0 <= s <= e <= MAX and parts[2]:
            rows.append([s, e, parts[2]])
    if not rows:
        return []
    rows.sort()

    # fill gaps: leading -> first interval, middle/trailing -> previous interval
    rows[0][0] = 0
    for prev, cur in zip(rows, rows[1:]):
        prev[1] = cur[0] - 1
    rows[-1][1] = MAX

    merged = [rows[0]]  # Part 3: merge neighbours with the same brand
    for r in rows[1:]:
        if r[2] == merged[-1][2]:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [f"{bin6}{s:010d},{bin6}{e:010d},{b}" for s, e, b in merged]


def main():
    lines = [l for l in sys.stdin.read().splitlines() if l.strip()]
    bin6 = lines[0].strip() if lines else ""
    n = int(lines[1]) if len(lines) > 1 else 0
    result = obfuscate(bin6, lines[2:2 + n])
    print("\n".join(result) if result else "NONE")


if __name__ == "__main__":
    main()

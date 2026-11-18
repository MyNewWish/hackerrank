"""Reference solution - store closing time penalty (all 3 parts).

Reads Q queries (PENALTY t log, BEST log, STREAM k + k lines) from stdin; prints one line per query.
"""
import sys


def _tokens(log):
    return log.split()


def compute_penalty(log, closing_time):
    t = _tokens(log)
    if not 0 <= closing_time <= len(t):
        return -1
    return t[:closing_time].count("N") + t[closing_time:].count("Y")


def _best(tokens):
    # penalty(0) = number of Y; moving the close one hour later: Y -> -1, N -> +1
    penalty = best = tokens.count("Y")
    best_t = 0
    for i, tok in enumerate(tokens, start=1):
        penalty += -1 if tok == "Y" else 1
        if penalty < best:
            best, best_t = penalty, i
    return best_t


def find_best_closing_time(log):
    return _best(_tokens(log))


def get_best_closing_times(aggregate_log):
    out, current = [], None      # current: list of tokens while inside BEGIN..END
    for tok in aggregate_log.split():
        if tok == "BEGIN":
            current = []          # a nested BEGIN discards the open log and restarts
        elif current is None:
            continue              # stray tokens outside a log
        elif tok == "END":
            out.append(_best(current))
            current = None
        elif tok in ("Y", "N"):
            current.append(tok)
        else:
            current = None        # garbage invalidates the open log
    return out


def main():
    lines = sys.stdin.read().splitlines()
    count, pos = int(lines[0]), 1
    for _ in range(count):
        fields = lines[pos].split()
        pos += 1
        if fields[0] == "PENALTY":
            print(compute_penalty(" ".join(fields[2:]), int(fields[1])))
        elif fields[0] == "BEST":
            print(find_best_closing_time(" ".join(fields[1:])))
        else:                                   # STREAM k
            k = int(fields[1])
            times = get_best_closing_times("\n".join(lines[pos:pos + k]))
            pos += k
            print(" ".join(map(str, times)) or "NONE")


if __name__ == "__main__":
    main()

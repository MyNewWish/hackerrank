"""Reference solution - store closing time penalty (all 3 parts)."""


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

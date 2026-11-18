"""Reference solution - CSV validator (all 4 parts)."""
import csv
import io


def validate(text, optional=(), refs=None):
    refs = refs or {}
    rows = [[c.strip() for c in r] for r in csv.reader(io.StringIO(text))]
    rows = [r for r in rows if r]               # skip blank lines entirely
    if not rows:
        return ["header: missing"]

    # Part 1 - header
    header, data = rows[0], rows[1:]
    errors, seen = [], set()
    for pos, name in enumerate(header, start=1):
        if not name:
            errors.append(f"header: empty column at position {pos}")
        elif name in seen:
            errors.append(f"header: duplicate column '{name}'")
        seen.add(name)
    for col in list(refs) + list(refs.values()):
        if col not in seen:
            errors.append(f"config: unknown column '{col}'")
    if errors:
        return errors

    # Part 2 - rows
    good = []  # (row_no, dict)
    for n, row in enumerate(data, start=1):
        if len(row) != len(header):
            errors.append(f"row {n}: expected {len(header)} fields, got {len(row)}")
            continue
        rec = dict(zip(header, row))
        for col in header:
            if not rec[col] and col not in optional:
                errors.append(f"row {n}: missing value for '{col}'")
        good.append((n, rec))

    # Part 3 - references
    for src, dst in refs.items():
        targets = {rec[dst] for _, rec in good if rec[dst]}
        for n, rec in good:
            v = rec[src]
            if v and v not in targets:
                errors.append(f"row {n}: {src} '{v}' not found in {dst}")

    # Part 4 - cycles
    for src, dst in refs.items():
        nxt = {rec[dst]: rec[src] for _, rec in good if rec[dst] and rec[src]}
        cycles = set()
        state = {}  # node -> 1 visiting, 2 done
        for start in sorted(nxt):
            path, node = [], start
            while node in nxt and node not in state:
                state[node] = 1
                path.append(node)
                node = nxt[node]
            if node in state and state[node] == 1:   # closed a loop in this walk
                cyc = path[path.index(node):]
                i = cyc.index(min(cyc))
                cyc = cyc[i:] + cyc[:i]
                cycles.add(" -> ".join(cyc + [cyc[0]]))
            for p in path:
                state[p] = 2
        errors += [f"cycle ({src}): {c}" for c in sorted(cycles)]
    return errors

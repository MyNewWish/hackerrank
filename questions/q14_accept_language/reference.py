"""Reference solution - Accept-Language negotiation (all 4 parts).

Reads the header line and the supported-tags line from stdin; prints one tag per line, or NONE.
"""

import sys


def _parse_header(header):
    """Return list of (tag_lower, q, index). Malformed pieces are skipped."""
    entries = []
    for idx, raw in enumerate(header.split(",")):
        raw = raw.strip()
        if not raw:
            continue
        tag, _, params = raw.partition(";")
        tag = tag.strip().lower()
        q = 1.0
        for p in params.split(";"):
            k, _, v = p.strip().partition("=")
            if k.strip().lower() == "q":
                try:
                    q = float(v)
                except ValueError:
                    q = 1.0
        if tag:
            entries.append((tag, q, idx))
    return entries


def _specificity(entry_tag, supported_tag):
    """Higher = more specific match. None = no match."""
    if entry_tag == supported_tag:
        return 3
    if entry_tag != "*" and supported_tag.startswith(entry_tag + "-"):
        return 2
    if entry_tag == "*":
        return 1
    return None


def parse_accept_language(header, supported):
    entries = _parse_header(header)
    scored = []  # (sort_key, tag)
    seen = set()
    for s_idx, tag in enumerate(supported):
        low = tag.lower()
        if low in seen:
            continue
        seen.add(low)
        best = None  # (specificity, q, header_index)
        for e_tag, q, h_idx in entries:
            spec = _specificity(e_tag, low)
            if spec is None:
                continue
            if best is None or spec > best[0]:
                best = (spec, q, h_idx)
        if best is None or best[1] <= 0:
            continue
        _, q, h_idx = best
        scored.append(((-q, h_idx, s_idx), tag))
    scored.sort()
    return [tag for _, tag in scored]


def main():
    lines = sys.stdin.read().splitlines()
    header = lines[0] if lines else ""
    supported = lines[1].split() if len(lines) > 1 else []
    result = parse_accept_language(header, supported)
    print("\n".join(result) if result else "NONE")


if __name__ == "__main__":
    main()

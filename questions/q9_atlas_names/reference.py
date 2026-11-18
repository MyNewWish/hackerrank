"""Reference solution - Atlas company name check (all 3 parts).

Reads a request count and the request lines from stdin; prints one line per
request that produces output.
"""
import sys

SUFFIXES = {"inc.", "corp.", "llc", "l.l.c.", "llc."}
ARTICLES = {"the", "an", "a"}


def normalize(name):
    s = name.lower().replace("&", " ").replace(",", " ")
    tokens = [t for t in s.split() if t not in SUFFIXES]
    if tokens and tokens[0] in ARTICLES:
        tokens = tokens[1:]
    tokens = [t for i, t in enumerate(tokens) if t != "and" or i == 0]
    return " ".join(tokens)


class NameRegistry:
    def __init__(self):
        self.owner = {}       # normalized -> account_id
        self.proposals = {}   # (account_id, original) -> normalized

    def process(self, requests):
        out = []
        for line in requests:
            if line.startswith("RECLAIM,"):
                parts = line.split(",", 2)
                if len(parts) != 3:
                    continue
                _, acct, original = (p.strip() for p in parts)
                key = (acct, original)
                norm = self.proposals.get(key)
                if norm is not None and self.owner.get(norm) == acct:
                    del self.owner[norm]
                    del self.proposals[key]
                    out.append(f"{acct}|Reclaimed")
                else:
                    out.append(f"{acct}|Reclaim Denied")
                continue
            acct, sep, name = line.partition("|")
            if not sep:
                continue
            acct, name = acct.strip(), name.strip()
            norm = normalize(name)
            if norm and norm not in self.owner:
                self.owner[norm] = acct
                self.proposals[(acct, name)] = norm
                out.append(f"{acct}|Name Available")
            else:
                out.append(f"{acct}|Name Not Available")
        return out


def main():
    lines = sys.stdin.read().splitlines()
    n = int(lines[0]) if lines else 0
    registry = NameRegistry()
    out = []
    for line in lines[1:1 + n]:
        stripped = line.strip()
        if stripped == "RESET":
            registry = NameRegistry()
        elif stripped.startswith("NORMALIZE "):
            out.append(normalize(stripped[len("NORMALIZE "):]) or "(empty)")
        else:
            out += registry.process([stripped])
    print("\n".join(out))


if __name__ == "__main__":
    main()

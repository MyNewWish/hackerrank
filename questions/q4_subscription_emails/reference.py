"""Reference solution - subscription email scheduler (all 3 parts).

Reads the schedule, users and changes sections from stdin; prints one email per line.
"""
import sys
from bisect import bisect_right

RANK = {"start": 0, "change": 1, "reminder": 2, "end": 3}


def _lifecycle(schedule, end, begin):
    """Reminder + expiry emails for a given end date: [(day, rank, label)]."""

    out = []
    for key, label in schedule.items():
        if key == "end":
            out.append((end, RANK["end"], label))
        elif isinstance(key, int) and key < 0 and end + key >= begin:
            out.append((end + key, RANK["reminder"], label))
    return out


def send_schedule(users, schedule, changes=None):
    changes = changes or []
    emails = []  # (day, name, rank, label, plan)
    for u in users:
        name, begin = u["name"], u["begin_date"]
        end = begin + u["duration"]
        plan_days, plans = [begin], [u["plan"]]  # plan history for lookup by day
        notices = [(begin, RANK["start"], schedule["start"])]
        fixed = []
        pending = _lifecycle(schedule, end, begin)

        evs = sorted((c for c in changes if c["name"] == name), key=lambda c: c["change_date"])
        for c in evs:
            d = c["change_date"]
            if d < begin or d >= end:      # before start or already expired: ignore
                continue
            fixed += [p for p in pending if p[0] <= d]
            pending = [p for p in pending if p[0] > d]
            if "new_plan" in c:
                plan_days.append(d)
                plans.append(c["new_plan"])
                notices.append((d, RANK["change"], "Changed"))
            if "extension" in c:
                end += c["extension"]
                notices.append((d, RANK["change"], "Extended"))
                pending = [p for p in _lifecycle(schedule, end, begin) if p[0] > d]
        for day, rank, label in notices + fixed + pending:
            plan = plans[bisect_right(plan_days, day) - 1]
            emails.append((day, name, rank, label, plan))

    emails.sort(key=lambda e: (e[0], e[1], e[2]))
    return [f"{d}: [{label}] Subscription for {n} ({p})" for d, n, _, label, p in emails]


def _section(lines, pos):
    """The counted section starting at lines[pos]: (its lines, position after it)."""
    count = int(lines[pos])
    return lines[pos + 1:pos + 1 + count], pos + 1 + count


def parse_input(text):
    lines = text.splitlines()
    sched_lines, pos = _section(lines, 0)
    user_lines, pos = _section(lines, pos)
    change_lines, _ = _section(lines, pos) if pos < len(lines) else ([], pos)

    schedule = {}
    for line in sched_lines:
        key, label = line.split(" ", 1)
        schedule[key if key in ("start", "end") else int(key)] = label
    users = []
    for line in user_lines:
        name, plan, begin, duration = line.split()
        users.append({"name": name, "plan": plan, "begin_date": int(begin), "duration": int(duration)})
    changes = []
    for line in change_lines:
        name, day, kind, value = line.split()
        change = {"name": name, "change_date": int(day)}
        if kind == "PLAN":
            change["new_plan"] = value
        else:
            change["extension"] = int(value)
        changes.append(change)
    return users, schedule, changes


def main():
    users, schedule, changes = parse_input(sys.stdin.read())
    for email in send_schedule(users, schedule, changes):
        print(email)


if __name__ == "__main__":
    main()

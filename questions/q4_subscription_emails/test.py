import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)
SCHED = {"start": "Welcome", -15: "Upcoming expiry", "end": "Expired"}
A = {"name": "A", "plan": "X", "begin_date": 0, "duration": 30}
B = {"name": "B", "plan": "Y", "begin_date": 1, "duration": 15}


def E(day, label, name, plan):
    return f"{day}: [{label}] Subscription for {name} ({plan})"


def check(got, want):
    if got != want:
        print(f"{got} \n{want}")
    assert got == want, "\n  got:  " + "\n        ".join(got) + "\n  want: " + "\n        ".join(want)


def part1():
    check(m.send_schedule([A, B], SCHED), [
        E(0, "Welcome", "A", "X"),
        E(1, "Welcome", "B", "Y"),
        E(1, "Upcoming expiry", "B", "Y"),
        E(15, "Upcoming expiry", "A", "X"),
        E(16, "Expired", "B", "Y"),
        E(30, "Expired", "A", "X"),
    ])
    sched2 = {"start": "Welcome", -7: "1 week left", -1: "Last day", "end": "Expired"}
    C = {"name": "C", "plan": "P", "begin_date": 5, "duration": 5}
    check(m.send_schedule([C], sched2), [
        E(5, "Welcome", "C", "P"), E(9, "Last day", "C", "P"), E(10, "Expired", "C", "P")])


def part2():
    check(m.send_schedule([A], SCHED, [{"name": "A", "new_plan": "Z", "change_date": 5}]), [
        E(0, "Welcome", "A", "X"), E(5, "Changed", "A", "Z"),
        E(15, "Upcoming expiry", "A", "Z"), E(30, "Expired", "A", "Z")])
    check(m.send_schedule([A], SCHED, [{"name": "A", "new_plan": "Z", "change_date": 20}]), [
        E(0, "Welcome", "A", "X"), E(15, "Upcoming expiry", "A", "X"),
        E(20, "Changed", "A", "Z"), E(30, "Expired", "A", "Z")])
    check(m.send_schedule([A], SCHED, [{"name": "A", "new_plan": "Z", "change_date": 15}]), [
        E(0, "Welcome", "A", "X"), E(15, "Changed", "A", "Z"),
        E(15, "Upcoming expiry", "A", "Z"), E(30, "Expired", "A", "Z")])
    check(m.send_schedule([A], SCHED, [{"name": "A", "new_plan": "Z", "change_date": 30}]), [
        E(0, "Welcome", "A", "X"), E(15, "Upcoming expiry", "A", "X"), E(30, "Expired", "A", "X")])


def part3():
    check(m.send_schedule([A], SCHED, [{"name": "A", "extension": 10, "change_date": 20}]), [
        E(0, "Welcome", "A", "X"), E(15, "Upcoming expiry", "A", "X"),
        E(20, "Extended", "A", "X"), E(25, "Upcoming expiry", "A", "X"), E(40, "Expired", "A", "X")])
    check(m.send_schedule([A], SCHED, [{"name": "A", "extension": 10, "change_date": 5}]), [
        E(0, "Welcome", "A", "X"), E(5, "Extended", "A", "X"),
        E(25, "Upcoming expiry", "A", "X"), E(40, "Expired", "A", "X")])
    changes = [{"name": "A", "new_plan": "Z", "change_date": 22},
               {"name": "A", "extension": 10, "change_date": 20}]   # unsorted on purpose
    check(m.send_schedule([A, B], SCHED, changes), [
        E(0, "Welcome", "A", "X"),
        E(1, "Welcome", "B", "Y"), E(1, "Upcoming expiry", "B", "Y"),
        E(15, "Upcoming expiry", "A", "X"),
        E(16, "Expired", "B", "Y"),
        E(20, "Extended", "A", "X"), E(22, "Changed", "A", "Z"),
        E(25, "Upcoming expiry", "A", "Z"), E(40, "Expired", "A", "Z")])


run([part1, part2, part3])

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)


def check(got, want):
    assert got == want, "\n  got:  " + "\n        ".join(got) + "\n  want: " + "\n        ".join(want)


def part1():
    check(m.validate("id,name,email\n1,a,a@x"), [])
    check(m.validate("id,,email\n1,2,3"), ["header: empty column at position 2"])
    check(m.validate("id,name,id, \n1,2"), ["header: duplicate column 'id'",
                                             "header: empty column at position 4"])
    check(m.validate(" id , name \n1,a"), [])
    check(m.validate(""), ["header: missing"])


TEXT2 = 'id,name,city\n1,Ann,"Paris, FR"\n2,Bob\n3,,NYC\n4, Dan ,\n\n5,Eve,LA\n'


def part2():
    check(m.validate(TEXT2), ["row 2: expected 3 fields, got 2",
                              "row 3: missing value for 'name'",
                              "row 4: missing value for 'city'"])
    check(m.validate(TEXT2, optional={"city"}), ["row 2: expected 3 fields, got 2",
                                                 "row 3: missing value for 'name'"])
    check(m.validate("a,b\n,\n"), ["row 1: missing value for 'a'", "row 1: missing value for 'b'"])


def part3():
    text = "id,name,manager_id\na,Ann,\nb,Bob,a\nc,Cat,z\nd,,b\ne,Eve"
    check(m.validate(text, optional={"manager_id"}, refs={"manager_id": "id"}), [
        "row 4: missing value for 'name'",
        "row 5: expected 3 fields, got 2",
        "row 3: manager_id 'z' not found in id"])
    check(m.validate("id,x\n1,2", refs={"boss": "id"}), ["config: unknown column 'boss'"])


def part4():
    text = "id,manager_id\na,\nb,c\nc,d\nd,b\ne,e\nf,b\ng,a"
    check(m.validate(text, optional={"manager_id"}, refs={"manager_id": "id"}), [
        "cycle (manager_id): b -> c -> d -> b",
        "cycle (manager_id): e -> e"])
    text2 = "id,manager_id\nz,y\ny,x\nx,z"
    check(m.validate(text2, refs={"manager_id": "id"}), ["cycle (manager_id): x -> z -> y -> x"])
    # long chain must not blow the recursion limit
    n = 5000
    chain = "id,manager_id\n" + "\n".join(f"n{i},n{i + 1}" for i in range(n)) + f"\nn{n},n0"
    got = m.validate(chain, refs={"manager_id": "id"})
    assert len(got) == 1 and got[0].startswith("cycle (manager_id): n0 -> n1 -> "), got[:1]


run([part1, part2, part3, part4])

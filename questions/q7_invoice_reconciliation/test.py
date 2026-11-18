import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)


def check(got, want):
    if got != want:
        print(f"+ {got}")
        print(f"- {want}")
    assert got == want, "\n  got:  " + "\n        ".join(got) + "\n  want: " + "\n        ".join(want)


INV = ["INV-1,acme,USD,100.00,2026-01-10", "INV-2,acme,USD,50.00,2026-02-10",
       "INV-3,bolt,EUR,80.00,2026-01-20", "INV-4,acme,USD,30.00,2026-01-10"]


def part1():
    pays = ["PAY-1,acme,USD,60.00,2026-01-05,INV-1", "PAY-2,bolt,EUR,80.00,2026-01-06,INV-3",
            "PAY-3,acme,USD,50.00,2026-01-07,INV-2"]
    check(m.invoice_status(INV, pays), [
        "INV-1 PARTIAL paid=60.00 due=40.00", "INV-2 PAID paid=50.00 due=0.00",
        "INV-3 PAID paid=80.00 due=0.00", "INV-4 OPEN paid=0.00 due=30.00"])
    check(m.invoice_status(["I1,c,USD,0.30,2026-01-01"],
                           ["P1,c,USD,0.10,2026-01-01,I1", "P2,c,USD,0.20,2026-01-02,I1"]),
          ["I1 PAID paid=0.30 due=0.00"])


def part2():
    pays = ["PAY-1,acme,USD,120.00,2026-01-05,INV-1",   # overpay 20 -> INV-4
            "PAY-2,acme,USD,25.00,2026-01-06,",          # 10 -> INV-4, 15 -> INV-2
            "PAY-3,bolt,USD,10.00,2026-01-07,",          # no bolt USD invoices -> credit
            "PAY-4,acme,USD,100.00,2026-01-08,INV-9",    # unknown ref -> INV-2 35, credit 65
            "PAY-5,bolt,EUR,30.00,2026-01-09,INV-1"]     # other customer's invoice -> INV-3
    check(m.invoice_status(INV, pays), [
        "INV-1 PAID paid=100.00 due=0.00", "INV-2 PAID paid=50.00 due=0.00",
        "INV-3 PARTIAL paid=30.00 due=50.00", "INV-4 PAID paid=30.00 due=0.00"])
    check(m.customer_credits(INV, pays), ["acme USD 65.00", "bolt USD 10.00"])
    # oldest due date first, ties by invoice id; no payments at all -> no credits
    inv = ["X2,c,USD,10.00,2026-01-01", "X1,c,USD,10.00,2026-01-01", "X0,c,USD,10.00,2026-02-01"]
    check(m.invoice_status(inv, ["P,c,USD,15.00,2026-01-03,"]), [
        "X0 OPEN paid=0.00 due=10.00", "X1 PAID paid=10.00 due=0.00", "X2 PARTIAL paid=5.00 due=5.00"])
    check(m.customer_credits(inv, []), [])


def part3():
    inv = ["A1,acme,USD,100.00,2026-03-01", "A2,acme,USD,50.00,2026-02-01",
           "A3,acme,USD,20.00,2025-12-01", "A4,acme,EUR,10.00,2026-03-20",
           "B1,bolt,USD,40.00,2026-03-10"]
    pays = ["P1,acme,USD,30.00,2026-03-05,A1", "P2,bolt,USD,40.00,2026-03-31,B1",
            "P3,acme,USD,5.00,2026-02-01,"]
    check(m.aging_report(inv, pays, "2026-03-15"), [
        "acme EUR current=10.00 1-30=0.00 31-60=0.00 61+=0.00",
        "acme USD current=0.00 1-30=70.00 31-60=50.00 61+=15.00",
        "bolt USD current=0.00 1-30=40.00 31-60=0.00 61+=0.00"])
    check(m.aging_report(inv, pays, "2026-04-01"), [
        "acme EUR current=0.00 1-30=10.00 31-60=0.00 61+=0.00",
        "acme USD current=0.00 1-30=0.00 31-60=120.00 61+=15.00"])


def part4():
    rates = ["EUR USD 1.10"]
    inv = ["U1,acme,USD,110.00,2026-01-01", "U2,acme,USD,50.00,2026-01-02",
           "E1,acme,EUR,10.00,2026-01-03"]
    pays = ["P1,acme,EUR,100.00,2026-01-01,U1",   # -> 110.00 USD
            "P2,acme,USD,11.00,2026-01-02,E1",    # -> 10.00 EUR
            "P3,acme,EUR,10.00,2026-01-03,U2",    # -> 11.00 USD
            "P4,acme,GBP,5.00,2026-01-04,U2",     # no rate -> GBP credit
            "P5,acme,USD,0.01,2026-01-05,E1"]     # -> 0.01 EUR (half-up), E1 full -> credit
    check(m.invoice_status(inv, pays, rates=rates), [
        "E1 PAID paid=10.00 due=0.00", "U1 PAID paid=110.00 due=0.00",
        "U2 PARTIAL paid=11.00 due=39.00"])
    check(m.customer_credits(inv, pays, rates=rates), ["acme EUR 0.01", "acme GBP 5.00"])
    check(m.invoice_status(["Z1,c,USD,1.00,2026-01-01"], ["Q,c,EUR,0.15,2026-01-01,Z1"], rates=rates),
          ["Z1 PARTIAL paid=0.17 due=0.83"])


run([part1, part2, part3, part4])

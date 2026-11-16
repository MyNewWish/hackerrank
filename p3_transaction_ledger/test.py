import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from harness import run, load  # noqa: E402

m = load(sys.argv)
H = "timestamp,merchant,txn_id,type,amount,ref"


def part1():
    lines = [H,
             "100,acme,c1,CHARGE,10.00,",
             "105,acme,c2,CHARGE,5.50,",
             "110,bolt,c3,CHARGE,20.00,",
             "120,acme,r1,REFUND,3.25,c1",
             "130,bolt,r2,REFUND,1.00,c999",   # unknown charge -> ignored
             "bad,row",
             "140,bolt,c4,CHARGE,abc,",        # bad amount
             "141,bolt,c6,CHARGE,1.005,",      # 3 decimals
             "142,bolt,c7,CHARGE,-4.00,",      # negative
             "143,bolt,c8,PAYOUT,4.00,",       # unknown type
             "150,zed,c5,CHARGE,0.10,"]
    assert m.balances(lines) == ["acme: 12.25", "bolt: 20.00", "zed: 0.10"], m.balances(lines)
    assert m.balances([H, "1,f,a,CHARGE,0.10,", "2,f,b,CHARGE,0.20,"]) == ["f: 0.30"], "float trap"
    assert m.balances([H, "1,g,a,CHARGE,4,", "2,g,r,REFUND,5.00,a"]) == ["g: -1.00"]
    assert m.balances([H, "1,a,x,CHARGE,1.00,", "2,b,r,REFUND,1.00,x"]) == ["a: 1.00", "b: 0.00"], \
        "refund of another merchant's charge is ignored"


L2 = [H,
      "1,acme,c1,CHARGE,1.00,", "2,acme,c2,CHARGE,1.00,",
      "3,acme,c3,CHARGE,1.00,", "4,acme,c4,CHARGE,1.00,",
      "5,bolt,c5,CHARGE,1.00,", "6,bolt,c6,CHARGE,1.00,",
      "7,zed,c7,CHARGE,1.00,",
      "10,acme,d1,DISPUTE,,c1", "11,acme,d2,DISPUTE,,c2",
      "12,acme,d6,DISPUTE,,c1",          # second dispute on c1 -> ignored
      "13,bolt,d3,DISPUTE,,c5",
      "14,zed,d4,DISPUTE,,c7",
      "15,acme,d5,DISPUTE,,c6"]          # c6 belongs to bolt -> ignored


def part2():
    assert m.flagged_merchants(L2, 2, 0.5) == ["acme", "bolt"]
    assert m.flagged_merchants(L2, 2, 0.6) == []
    assert m.flagged_merchants(L2, 1, 1.0) == ["zed"]


def part3():
    l3 = [H,
          "200,acme,d1,DISPUTE,,c1",       # earlier in file, later in time
          "100,acme,c1,CHARGE,10.00,",
          "100,acme,c1,CHARGE,10.00,",     # duplicate delivery
          "150,acme,c2,CHARGE,4.00,",
          "300,acme,v1,REVERSAL,,d1",
          "250,acme,d2,DISPUTE,,c2"]
    # 10 + 4 - 10 (d1) - 4 (d2) + 10 (v1)
    assert m.balances(l3) == ["acme: 10.00"], m.balances(l3)
    assert m.flagged_merchants(l3, 1, 0.5) == ["acme"]
    assert m.flagged_merchants(l3, 1, 0.6) == []
    assert m.balances([H, "50,x,d9,DISPUTE,,c9", "60,x,c9,CHARGE,1.00,"]) == ["x: 1.00"], \
        "dispute before its charge (by time) is invalid"
    redispute = [H, "1,y,c,CHARGE,2.00,", "2,y,d,DISPUTE,,c", "3,y,v,REVERSAL,,d", "4,y,d2,DISPUTE,,c"]
    assert m.balances(redispute) == ["y: 0.00"]
    assert m.flagged_merchants(redispute, 1, 1.0) == ["y"]


def part4():
    l4 = [H,
          "1,acme,a1,CHARGE,1.00,", "2,acme,a2,CHARGE,1.00,", "3,acme,a3,CHARGE,1.00,",
          "4,bolt,b1,CHARGE,1.00,", "5,bolt,b2,CHARGE,1.00,", "6,bolt,b3,CHARGE,1.00,",
          "100,acme,da1,DISPUTE,,a1", "150,acme,da2,DISPUTE,,a2", "400,acme,da3,DISPUTE,,a3",
          "100,bolt,db1,DISPUTE,,b1", "200,bolt,db2,DISPUTE,,b2",
          "120,bolt,db3,DISPUTE,,b3", "130,bolt,vb3,REVERSAL,,db3"]  # reversed: doesn't count
    assert m.burst_merchants(l4, 100, 2) == ["acme"]
    assert m.burst_merchants(l4, 101, 2) == ["acme", "bolt"]
    assert m.burst_merchants(l4, 1000, 3) == ["acme"]
    assert m.burst_merchants(l4, 1000, 4) == []


run([part1, part2, part3, part4])

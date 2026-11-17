# Stripe HackerRank screen: 7-day prep kit (Python)

## What the screen looks like (from 2025–2026 candidate reports)
- About **60 min** on HackerRank. Usually **one long practical problem split into
  3–4 parts**, and each part builds on your earlier code. Some versions have 3
  separate questions. Many people run out of time on the last part.
- The topics are **parsing and data processing**, not LeetCode puzzles: transaction or
  payment logs, billing intervals, fraud or dispute thresholds, the Accept-Language
  header, shipping or currency conversion through a graph hidden in a string, rate
  limiters, retrying failed events.
- Grading uses **hidden test cases with strict output matching** (spacing, ordering,
  number formatting). One complaint was that "output types are not given", so read
  the sample I/O like a spec.
- AI-assistant rules differ between rounds. **Ask your recruiter** whether AI or web
  search is allowed, and assume it isn't unless they say so.

## What they're really grading
1. Turning a long English spec into working code **quickly and correctly**.
2. Code you can **extend**: Part 3 shouldn't force a rewrite of Part 1.
3. Edge cases from real life: malformed rows, duplicates (idempotency),
   out-of-order events, money stored as integer cents or `Decimal` and never as float,
   tie-breaking, empty input.

## The kit
| Problem | Real-world theme | Target |
|---|---|---|
| `questions/q1_accept_language` | HTTP header negotiation | 45 min |
| `questions/q2_shipping_cost` | lanes string → graph, Dijkstra with constraints | 50 min |
| `questions/q3_transaction_ledger` | charges/refunds/disputes, out-of-order, idempotency | 60 min |
| `questions/q4_subscription_emails` | billing lifecycle simulation | 50 min |
| `questions/q5_request_routing` ★ | route matching, precedence, weighted round-robin, health | 60 min |
| `questions/q6_payment_commands` ★ | payment state machine, partial capture/refund, idempotency keys | 60 min |
| `p7_invoice_reconciliation` ★ | allocate payments to invoices, credits, aging, FX rounding | 60 min |
| `p8_csv_validation` | header/row checks, cross-column refs, cycle detection | 50 min |

| `p9_atlas_names` | company-name normalization, registry, reclaim | 45 min |
| `p10_card_ranges` | BIN interval gap-filling and merging, stdin parsing | 40 min |
| `p11_fraud_mcc` ★ | "Catch Me If You Can": MCC thresholds, count, then %, then disputes | 50 min |
| `p12_store_closing` | closing-time penalty, O(n) scan, BEGIN/END token state machine | 40 min |
| `p13_card_validation` | Luhn, network detection, redacted `*` digits, typo recovery | 50 min |
| `p14_datacenter_routing` ★ | FastPrep "Request Routing System": REGISTER/SET_HEALTHY, Haversine, capacity-aware ROUTE, strict parsing | 60 min |

★ = reported most often in 2026, so prioritise these.
p9–p13 (plus q4, "Subscription Notification Scheduler") come from
[extrabrain's Stripe OA list](https://extrabrain.app/interview-questions/stripe-hackerrank-online-assessment-extrabrain/).
That page leaves gaps and has wrong examples, so each problem.md states the rules the tests use.

The `questions/qN_*` folders are stdin → stdout questions for the practice app in `app/`:
each has `problem.md`, `question.yaml`, `reference.py`, and sample and hidden tests in
`tests/partN/`. The remaining `pN_*` folders contain `problem.md`, `solution.py` (empty stub
you fill in), `test.py`, and `reference.py`. Run `python test.py` to test your code or
`python test.py ref` to test the reference. **Keep reference.py closed until you've made a timed attempt.**

## 7-day plan
| Day | Do |
|---|---|
| 1 | Read this file. Do P1 and P2 with timers, then compare with the references. |
| 2 | Finish P3 (use `Decimal`, not float). Then do P6 (payment commands). |
| 3 | P5 (request routing) and P7 (invoice reconciliation). |
| 4 | P4 and P8. In the evening, redo the worst one from scratch. |
| 5 | Untested variants with your own asserts: rate limiter (fixed window, then sliding window, then token bucket), Luhn check plus card brand detection, masking card numbers in log lines. |
| 6 | Full mock: delete your solutions to 2 of the ★ problems and solve each in 60 min. Practise reading stdin (template below). |
| 7 | Light review only. Take the test when you're fresh and have a quiet hour. |

## In-test checklist
1. **Read every part's text first** if HackerRank shows it (often it only shows the current part).
   Read the sample I/O twice.
2. Write the **data model and parser first** (a dataclass or dict), then a function per query.
3. Get the sample passing quickly, **submit to see hidden-test results**, then fix edge cases.
   A part that passes counts for more than a perfect but unfinished design.
4. Give helpers clear names. Don't over-engineer: no classes beyond what the parts need.
5. Before you move to the next part, check: empty input, duplicates, ties, sort order,
   formatting (`f"{x:.2f}"`, trailing spaces, newline at end).
6. Under time pressure, leave a short comment saying what you'd do next.
   Some graders read the code.

## Python toolkit to have at your fingertips
```python
from collections import defaultdict, Counter, deque, OrderedDict
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
import heapq, bisect, itertools, re, json, csv, io

cents = int(Decimal("12.34") * 100)                       # money: no floats
Decimal("2.675").quantize(Decimal("0.01"), ROUND_HALF_UP)  # -> 2.68
f"{c // 100}.{c % 100:02d}"                               # format cents (handle sign separately)
sorted(rows, key=lambda r: (-r.amount, r.ts, r.id))       # multi-key, mixed directions
k, _, v = "q=0.5".partition("=")                          # parsing without exceptions
rows = list(csv.reader(io.StringIO(text)))                # handles quoted commas
heapq.heappush(h, (cost, tiebreak, item))                 # Dijkstra / scheduling
```

### HackerRank stdin template (when they don't give you a function stub)
```python
import sys

def main():
    data = sys.stdin.read().splitlines()
    n = int(data[0])
    rows = data[1:1 + n]
    for line in solve(rows):
        print(line)

if __name__ == "__main__":
    main()
```

## Sources
- [prachub: Stripe Backend HackerRank parsing and data-processing assessment](https://prachub.com/interview-experiences/stripe-backend-engineer-interview-hackerrank-parsing-and-data-processing-assessment-bca80c5c77)
- [prachub: Stripe OA, one long coding problem](https://prachub.com/resources/stripe-swe-intern-oa-2027-one-long-coding-problem-input-parsing-and-clean-code)
- [prachub: three-part coding screen](https://prachub.com/interview-experiences/stripe-software-engineer-interview-experience-a-month-of-scheduling-delays-then-a-tight-three-part-coding-screen)
- [LeetCode: Stripe Accept-Language question](https://leetcode.com/discuss/post/3102019/)
- [LeetCode: Stripe phone screen (shipping cost)](https://leetcode.com/discuss/post/5883672/stripe-phone-screen-by-anonymous_user-0kk5/)
- [Lodely: Stripe OA 2025 breakdown](https://www.lodely.com/blog/stripe-online-assessment-2025)
- [Prepfully: Stripe SWE guide](https://prepfully.com/interview-guides/stripe-software-engineer)
- [Glassdoor: Stripe interview review](https://www.glassdoor.com/Interview/Stripe-Interview-RVW84471415.htm)

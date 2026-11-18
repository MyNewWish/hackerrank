# Study guide: Stripe HackerRank screen (Python)

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

The questions reported most often in 2026 are q1 (datacenter routing), q5 (request routing),
q6 (payment commands), q7 (invoice reconciliation) and q11 (fraud MCC). Prioritise these.

## 7-day plan
Do every question in the app's test mode, with the timer running. Open the reference only after a timed attempt.

| Day | Do |
|---|---|
| 1 | Read this file. Do q14 (Accept-Language) and q2 (shipping cost), then compare with the references. |
| 2 | q3 (transaction ledger; use `Decimal`, not float). Then q6 (payment commands). |
| 3 | q5 (request routing) and q7 (invoice reconciliation). |
| 4 | q4 and q8. In the evening, redo the worst one from scratch. |
| 5 | q1 (datacenter routing) and q11 (fraud MCC). Then a variant with your own tests: a rate limiter (fixed window, then sliding window, then token bucket). |
| 6 | Full mock: delete `workspace/q<N>_solution.py` for 2 of the most-reported questions and solve each again from an empty file in 60 min. |
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

### stdin template (when they don't give you a function stub)
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
- [extrabrain: Stripe OA question list](https://extrabrain.app/interview-questions/stripe-hackerrank-online-assessment-extrabrain/) (source of q4 and q9–q13; each problem.md states the rules the tests use)
- [LeetCode: Stripe Accept-Language question](https://leetcode.com/discuss/post/3102019/)
- [LeetCode: Stripe phone screen (shipping cost)](https://leetcode.com/discuss/post/5883672/stripe-phone-screen-by-anonymous_user-0kk5/)
- [Lodely: Stripe OA 2025 breakdown](https://www.lodely.com/blog/stripe-online-assessment-2025)
- [Prepfully: Stripe SWE guide](https://prepfully.com/interview-guides/stripe-software-engineer)
- [Glassdoor: Stripe interview review](https://www.glassdoor.com/Interview/Stripe-Interview-RVW84471415.htm)

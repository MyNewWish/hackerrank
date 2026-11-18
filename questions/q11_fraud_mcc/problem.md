# Catch Me If You Can (MCC fraud thresholds)

Every merchant (account) has an MCC (merchant category code), and every MCC has a fraud
threshold. You replay a stream of charge events and report the merchants that were
caught as fraudulent.

- A charge's response code is either a **non-fraud** code, a **fraud** code, or neither.
- Ignore a charge whose code is in neither list, whose merchant is unknown, whose
  merchant's MCC has no threshold, or whose charge id was already seen. Ignored charges
  are not counted at all.
- `counted` is a merchant's number of counted charges; `fraud_count` is how many of those
  have a fraud code. The amount plays no role.
- A merchant is only evaluated once `counted >= min_txns`.

## Input Format

1. The non-fraud response codes, comma-separated (`approved,invalid_pin`).
2. The fraud response codes, comma-separated (`do_not_honor,stolen_card`).
3. The mode and `min_txns`, separated by a space: `COUNT 3` (Part 1) or `PERCENT 2`
   (Parts 2 and 3).
4. An integer `T`, then `T` threshold lines `MCC,threshold`.
5. An integer `M`, then `M` merchant lines `account_id,MCC`.
6. An integer `E`, then `E` event lines: `CHARGE,charge_id,account_id,amount,code`, or
   (Part 3) `DISPUTE,charge_id`.

```
approved,invalid_pin
do_not_honor,stolen_card,lost_card
COUNT 2
2
5411,2
7995,1
3
acct_a,5411
acct_b,7995
acct_c,5411
3
CHARGE,c1,acct_a,100,do_not_honor
CHARGE,c2,acct_a,100,stolen_card
CHARGE,c3,acct_b,100,lost_card
```

## Output Format

A single line: the fraudulent account ids at the end of the stream, sorted and
separated by commas, or `NONE` if there are none.

```
acct_a
```

`acct_b` has only one counted charge, so it is never evaluated with `min_txns = 2`.

## Part 1 — Fraud by count

Mode `COUNT`: each threshold is an integer. After each counted charge, its merchant is
fraudulent if `counted >= min_txns` and `fraud_count >= threshold`. Once marked, a
merchant stays fraudulent.

Input:
```
approved,invalid_pin
do_not_honor,stolen_card,lost_card
COUNT 2
2
5411,2
7995,1
3
acct_a,5411
acct_b,7995
acct_c,5411
10
CHARGE,c1,acct_a,100,do_not_honor
CHARGE,c2,acct_a,100,stolen_card
CHARGE,c3,acct_b,100,lost_card
CHARGE,c4,acct_c,100,approved
CHARGE,c5,acct_a,100,approved
CHARGE,c6,acct_b,100,approved
CHARGE,c7,acct_c,100,stolen_card
CHARGE,c8,acct_c,100,weird_code
CHARGE,c9,acct_z,100,stolen_card
CHARGE,c7,acct_c,100,stolen_card
```
Output:
```
acct_a,acct_b
```

`acct_c` has one fraud charge out of two; `c8` (unknown code), `c9` (unknown merchant)
and the second `c7` (repeated id) are ignored.

## Part 2 — Fraud by percentage

Mode `PERCENT`: each threshold is a decimal in `[0, 1]`. After each counted charge, its
merchant is fraudulent if `counted >= min_txns` and `fraud_count / counted >= threshold`.
**Once marked, a merchant stays fraudulent**, even if later good charges bring its ratio
down. Compare exactly (for example with `fractions.Fraction`), not with floats:
`3 / 10 >= 0.3` is true.

Input:
```
approved,invalid_pin
do_not_honor,stolen_card,lost_card
PERCENT 2
2
5411,0.5
7995,0.25
3
acct_a,5411
acct_b,7995
acct_c,5411
11
CHARGE,c1,acct_a,100,approved
CHARGE,c2,acct_a,100,stolen_card
CHARGE,c3,acct_a,100,approved
CHARGE,c4,acct_a,100,approved
CHARGE,c5,acct_b,100,approved
CHARGE,c6,acct_b,100,approved
CHARGE,c7,acct_b,100,approved
CHARGE,c8,acct_b,100,lost_card
CHARGE,c9,acct_c,100,approved
CHARGE,c10,acct_c,100,approved
CHARGE,c11,acct_c,100,stolen_card
```
Output:
```
acct_a,acct_b
```

`acct_a` hits 1/2 after `c2` and stays marked at 1/4. `acct_b` ends at 1/4 >= 0.25.
`acct_c` peaks at 1/3 < 0.5.

## Part 3 — Disputes

`DISPUTE,charge_id` turns that charge into a non-fraud charge; it still counts toward
`counted`. Ignore a dispute of an unknown (never counted) or already-disputed charge.
After a dispute, re-check the charge's merchant: if it is marked but no longer meets the
condition, **un-mark it**. Later charges can mark it again. Part 3 inputs use mode
`PERCENT`.

Input:
```
approved,invalid_pin
do_not_honor,stolen_card,lost_card
PERCENT 2
2
5411,0.5
7995,0.25
3
acct_a,5411
acct_b,7995
acct_c,5411
6
CHARGE,d1,acct_a,100,stolen_card
CHARGE,d2,acct_a,100,approved
DISPUTE,d1
CHARGE,d3,acct_a,100,stolen_card
DISPUTE,d1
CHARGE,d4,acct_a,100,stolen_card
```
Output:
```
acct_a
```

`acct_a` is marked at 1/2, cleared by the dispute (0/2), not marked at 1/3, the second
dispute of `d1` is ignored, and `d4` marks it again at 2/4.

---

Source: ["Catch Me If You Can"](https://extrabrain.app/interview-questions/stripe-hackerrank-online-assessment-extrabrain/) on extrabrain's Stripe HackerRank OA list.
Rewritten for this bank; the rules above fill gaps
and fix errors in the original, so they win where the two differ.
It is the same family as the "merchant fraud monitor" in the 2026 reports; the page
gives no samples.

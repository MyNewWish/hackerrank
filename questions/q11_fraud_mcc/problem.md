# P11 — Catch Me If You Can (MCC fraud thresholds)  (target: 50 min for all parts)

Source: "Catch Me If You Can" from extrabrain's Stripe HackerRank OA list. This is the
same family as the "merchant fraud monitor" in the 2026 reports. The page gives no
samples, so the rules below fill the gaps.

Inputs:
1. `non_fraud`: comma-separated response codes that are **not** fraud, e.g. `"approved,invalid_pin"`.
2. `fraud`: comma-separated response codes that **are** fraud, e.g. `"do_not_honor,stolen_card"`.
3. `thresholds`: list of `"MCC,threshold"`.
4. `merchants`: list of `"account_id,MCC"`.
5. `min_txns`: a merchant is evaluated only once it has at least this many counted charges.
6. `events`: list of `"CHARGE,charge_id,account_id,amount,code"`, plus `"DISPUTE,charge_id"`
   in Part 3.

Output: the comma-separated, sorted fraudulent account ids, or `""` if there are none.

Ignore charges whose code is in neither list, whose merchant (or the merchant's MCC) is
unknown, or whose charge_id was already seen. `amount` plays no role.

## Part 1 — `fraud_by_count(...)`
The threshold is an integer. After each charge, a merchant is fraudulent if
`counted >= min_txns` and `fraud_count >= threshold`.

## Part 2 — `fraud_by_percent(...)`
The threshold is a decimal in [0, 1]. The condition becomes `fraud_count / counted >= threshold`,
checked after each charge. **Once marked, a merchant stays fraudulent**, even if later good
charges bring its ratio down. Compare exactly (`fractions.Fraction`), not with floats.

## Part 3 — disputes (in `fraud_by_percent`)
`"DISPUTE,charge_id"` turns that charge into a non-fraud charge. It still counts toward
`counted`. Ignore disputes on unknown or already-disputed charges. After a dispute,
re-check the merchant: if it is marked but no longer meets the condition, **un-mark it**.
Later charges can mark it again.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

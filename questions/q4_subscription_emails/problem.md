# Subscription email scheduler

A classic Stripe Billing-flavored question: simulate the lifecycle emails of
subscriptions over time.

Each user has a name, a plan, a `begin_date` and a `duration` (whole days), and
`end = begin_date + duration`. The email schedule maps keys to labels:

- `start`: sent on `begin_date`.
- `end`: sent on the end date.
- A negative integer `-n`: a reminder sent `n` days **before** the end date.

Each email is printed as `{day}: [{label}] Subscription for {name} ({plan})`.
Sort emails by day, then name, then kind: start < change notices < reminders < end.

## Input Format

Three counted sections, each an integer count followed by that many lines:

1. **Schedule**: lines `KEY LABEL`, where `KEY` is `start`, `end` or a negative
   integer, and `LABEL` is the rest of the line (it may contain spaces).
2. **Users**: lines `NAME PLAN BEGIN_DATE DURATION`.
3. **Changes** (Parts 2 and 3; the count is `0` in Part 1): lines
   `NAME CHANGE_DATE PLAN NEW_PLAN` or `NAME CHANGE_DATE EXTEND DAYS`.

```
3
start Welcome
-15 Upcoming expiry
end Expired
1
A X 0 30
0
```

## Output Format

Every email, one per line, in the sort order above.

```
0: [Welcome] Subscription for A (X)
15: [Upcoming expiry] Subscription for A (X)
30: [Expired] Subscription for A (X)
```

## Part 1 — Lifecycle emails

Send the `start` email, every reminder, and the `end` email for each user.
Skip reminders that would fall before `begin_date`.

Input:
```
3
start Welcome
-15 Upcoming expiry
end Expired
1
A X 0 30
0
```
Output:
```
0: [Welcome] Subscription for A (X)
15: [Upcoming expiry] Subscription for A (X)
30: [Expired] Subscription for A (X)
```

## Part 2 — Plan changes

A change `NAME CHANGE_DATE PLAN NEW_PLAN` switches the user to `NEW_PLAN`.

- Send `[Changed]` on the change date (showing the new plan).
- Each email shows the plan in effect **on the day it is sent** (a change on day d
  applies to emails on day d).
- Ignore changes before `begin_date` or on/after the current end date.

Input:
```
3
start Welcome
-15 Upcoming expiry
end Expired
1
A X 0 30
1
A 5 PLAN Z
```
Output:
```
0: [Welcome] Subscription for A (X)
5: [Changed] Subscription for A (Z)
15: [Upcoming expiry] Subscription for A (Z)
30: [Expired] Subscription for A (Z)
```

## Part 3 — Extensions

A change `NAME CHANGE_DATE EXTEND DAYS` extends the subscription.

- Send `[Extended]` on the change date. The end date moves by `DAYS` days.
- Emails already sent (day ≤ change date) stay. Unsent reminders and the expiry are
  recomputed from the new end date; recomputed ones on/before the change date are dropped.
- Changes are applied in change-date order, whatever their order in the input.

Input:
```
3
start Welcome
-15 Upcoming expiry
end Expired
1
A X 0 30
1
A 20 EXTEND 10
```
Output:
```
0: [Welcome] Subscription for A (X)
15: [Upcoming expiry] Subscription for A (X)
20: [Extended] Subscription for A (X)
25: [Upcoming expiry] Subscription for A (X)
40: [Expired] Subscription for A (X)
```

Note: extrabrain's version of this problem calls the extension event a renewal and labels
it `[Renewed]` instead of `[Extended]`. Read the label from the prompt you actually get.

# P4 — Subscription email scheduler  (target: 50 min for all parts)

A classic Stripe Billing-flavored question: simulate the lifecycle emails of
subscriptions over time.

```python
users = [{"name": "A", "plan": "X", "begin_date": 0, "duration": 30}]
schedule = {"start": "Welcome", -15: "Upcoming expiry", "end": "Expired"}
```

`end = begin_date + duration`. Schedule keys: `"start"` (sent on begin_date),
`"end"` (sent on the end date), and negative ints = days **before** end.

Output: list of strings `"{day}: [{label}] Subscription for {name} ({plan})"`,
sorted by day, then name, then kind: start < change notices < reminders < end.

## Part 1 — `send_schedule(users, schedule)`
Skip reminders that would fall before `begin_date`.

```
0: [Welcome] Subscription for A (X)
15: [Upcoming expiry] Subscription for A (X)
30: [Expired] Subscription for A (X)
```

## Part 2 — plan changes: `send_schedule(users, schedule, changes)`
`changes` may contain `{"name": "A", "new_plan": "Z", "change_date": 5}`.
- Send `"[Changed]"` on the change date (showing the new plan).
- Each email shows the plan in effect **on the day it is sent** (a change on day d
  applies to emails on day d).
- Ignore changes before begin_date or on/after the current end date.

## Part 3 — extensions
`changes` may also contain `{"name": "A", "extension": 10, "change_date": 20}`.
- Send `"[Extended]"` on the change date. The end date moves by `extension` days.
- Emails already sent (day ≤ change_date) stay. Unsent reminders/expiry are
  recomputed from the new end date; recomputed ones on/before change_date are dropped.
- Changes are applied in change_date order.

```
users A (above), changes = [{"name":"A","extension":10,"change_date":20}]
0: [Welcome] Subscription for A (X)
15: [Upcoming expiry] Subscription for A (X)
20: [Extended] Subscription for A (X)
25: [Upcoming expiry] Subscription for A (X)
40: [Expired] Subscription for A (X)
```

Note: extrabrain's version of this problem calls the extension event a renewal and labels
it `[Renewed]` instead of `[Extended]`. Read the label from the prompt you actually get.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

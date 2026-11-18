# P8 — CSV validator  (target: 50 min for all parts)

A reported Stripe technical-screen question with 4 parts: empty headers, then missing values,
then cross-column references, then circular dependencies.

```python
def validate(text: str, optional=(), refs=None) -> list[str]   # [] means valid
```

`text` is a whole CSV file. Fields may be quoted and contain commas (`"Paris, FR"`), so
consider the `csv` module. Trim whitespace around every value. **Completely blank lines are
skipped and don't count** when numbering rows. Data rows are numbered from 1; the header
isn't counted.

## Part 1 — header
Check columns left to right:
- `"header: empty column at position 2"` (positions start at 1)
- `"header: duplicate column 'id'"`
- If the text is empty, return `["header: missing"]`.
- If there are any header errors, return them without checking rows.

## Part 2 — rows
For each row, in order:
- `"row 2: expected 3 fields, got 2"`. When this happens, skip the row's other checks
  (and leave the row out of Parts 3 and 4).
- `"row 3: missing value for 'name'"` for each empty value, in column order. Columns listed
  in `optional` may be empty.

## Part 3 — references
`refs={"manager_id": "id"}` means every non-empty `manager_id` must appear somewhere in
column `id` (only well-formed rows count):
`"row 3: manager_id 'z' not found in id"`. Report these after all Part 2 errors, in row
order. If a column named in `refs` isn't in the header, report
`"config: unknown column 'boss'"` together with the header errors and stop there.

## Part 4 — circular dependencies
Follow each `refs` link (an `id` points to its `manager_id`) and report every cycle once,
starting from its smallest id, with the cycle list sorted:
`"cycle (manager_id): b -> c -> d -> b"`, `"cycle (manager_id): e -> e"`.
A node that points into a cycle but isn't part of it doesn't count. Cycle errors come last.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

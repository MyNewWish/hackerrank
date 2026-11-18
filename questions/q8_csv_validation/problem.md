# CSV validator

A reported Stripe technical-screen question with 4 parts: empty headers, then missing
values, then cross-column references, then circular dependencies.

Validate a whole CSV file and report every error. Fields may be quoted and contain
commas (`"Paris, FR"`), so consider your language's CSV parser. Trim whitespace around
every value. **Completely blank lines are skipped and don't count** when numbering rows.
The first non-blank line is the header; data rows are numbered from 1 after it.

## Input Format

1. An integer `K`, the number of config lines.
2. `K` config lines, each one of:
   - `OPTIONAL COLUMN`: column `COLUMN` may be empty (Part 2).
   - `REF SRC DST`: every value in column `SRC` must appear in column `DST` (Parts 3
     and 4). `REF` lines are checked in input order.
3. The rest of the input is the CSV file, verbatim. It may be empty.

```
1
OPTIONAL city
id,name,city
1,Ann,"Paris, FR"
2,Bob
```

## Output Format

Every error, one per line, in the order the parts below describe. If there are no
errors, print the single line `VALID`.

```
row 2: expected 3 fields, got 2
```

## Part 1 — Header

Check the header's columns left to right:

- `header: empty column at position P` (positions start at 1)
- `header: duplicate column 'NAME'`
- If the CSV is empty (no non-blank lines), print `header: missing`.
- If there are any header errors, print them without checking rows.

Input:
```
0
id,name,email
1,a,a@x
```
Output:
```
VALID
```

Input:
```
0
id,name,id, 
1,2
```
Output:
```
header: duplicate column 'id'
header: empty column at position 4
```

## Part 2 — Rows

For each data row, in order:

- `row N: expected C fields, got F` when the row doesn't have one field per column.
  When this happens, skip the row's other checks (and leave the row out of Parts 3
  and 4).
- `row N: missing value for 'COLUMN'` for each empty value, in column order. Columns
  marked `OPTIONAL` may be empty.

Input:
```
0
id,name,city
1,Ann,"Paris, FR"
2,Bob
3,,NYC
4, Dan ,

5,Eve,LA
```
Output:
```
row 2: expected 3 fields, got 2
row 3: missing value for 'name'
row 4: missing value for 'city'
```

## Part 3 — References

`REF manager_id id` means every non-empty `manager_id` must appear somewhere in column
`id` (only well-formed rows count):
`row N: manager_id 'z' not found in id`. Report these after all Part 2 errors, in row
order (all rows for the first `REF`, then the next `REF`).

If a column named in a `REF` line (either `SRC` or `DST`) isn't in the header, report
`config: unknown column 'NAME'` after the header errors (for each `REF` line in order,
`SRC` before `DST`) and stop there.

Input:
```
2
OPTIONAL manager_id
REF manager_id id
id,name,manager_id
a,Ann,
b,Bob,a
c,Cat,z
d,,b
e,Eve
```
Output:
```
row 4: missing value for 'name'
row 5: expected 3 fields, got 2
row 3: manager_id 'z' not found in id
```

## Part 4 — Circular dependencies

Follow each `REF` link (a row's `DST` value points to its `SRC` value) and report every
cycle once, as `cycle (SRC): ` followed by the cycle starting from its smallest id
(string order) and returning to it. Within one `REF`, cycles are sorted by that text.
A node that points into a cycle but isn't part of it doesn't count. Cycle errors come
last. Chains can be thousands of rows long.

Input:
```
2
OPTIONAL manager_id
REF manager_id id
id,manager_id
a,
b,c
c,d
d,b
e,e
f,b
g,a
```
Output:
```
cycle (manager_id): b -> c -> d -> b
cycle (manager_id): e -> e
```

# Edge-case checklist for hidden tests

Each hidden input targets one or two named cases from this list. Pick the ones a part's rules
make meaningful; a part needs 3–6 inputs, not one per line here. Every case you test must
follow from a rule stated in `problem.md`; if it doesn't, add the rule there first.

## Shape of the input

- **Empty**: zero records (`0` count, header only, blank body).
- **Single**: exactly one record.
- **Large**: enough records to punish a quadratic solution (see step 6 of `SKILL.md` for how
  to make them).

## Values

- **Boundaries**: zero, one, the maximum, exactly at a threshold, one either side of it.
- **Money**: amounts that round (`.005`), negative or zero amounts, sums across many small
  amounts (where float drift would show), formatting of cents (`5` → `0.05`).
- **Case and whitespace**: mixed case where the spec says it's case-insensitive, extra spaces
  where the spec allows them.

## Records

- **Duplicates**: the same id or key twice (idempotency, first wins vs last wins).
- **Malformed**: wrong field count, non-numeric number, unknown command or type, missing
  required field; and malformed records mixed in with good ones.
- **Unknown references**: an id, node or key that was never defined.

## Order

- **Ties**: equal sort keys, so the tie-break rule decides the output.
- **Out of order**: events whose timestamps arrive unsorted, if the spec allows it.
- **Error precedence**: one record that breaks several rules, so the precedence order decides
  which error is printed.

## State

- **Invalid transitions**: an action from every state that forbids it.
- **Repeated actions**: the same action twice in a row (double capture, double refund).
- **Interaction with earlier parts**: inputs mixing this part's features with earlier
  parts' features, so the extension is tested alongside what it extends.

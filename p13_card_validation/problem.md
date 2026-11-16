# P13 — Payment card validation  (target: 50 min for all parts)

Source: "Stripe Payment Card Validation System" from extrabrain's Stripe HackerRank OA list.

Networks:
| Network | Length | Prefix |
|---|---|---|
| VISA | 16 | `4` |
| MASTERCARD | 16 | `51`–`55` |
| AMEX | 15 | `34` or `37` |

**Luhn checksum**: going from the rightmost digit leftward, double every second digit
(the 2nd from the right, the 4th, …). If a doubled value is > 9, subtract 9. The number
is valid if the sum of all digits is divisible by 10.
`4242424242424242`, `378282246310005` and `5555555555554444` are valid test cards.

## Part 1 — `validate_visa(card) -> str`
The input is always 16 digits starting with 4. Return `"VISA"` if Luhn passes, otherwise
`"INVALID_CHECKSUM"`.

## Part 2 — `classify(card) -> str`
Return the network name if the network matches and Luhn passes, `"INVALID_CHECKSUM"` if
the network matches but Luhn fails, and `"UNKNOWN_NETWORK"` if the length or prefix
matches no network, or the input isn't all digits.

## Part 3 — `count_redacted(card) -> list[str]`
1 to 5 digits are replaced by `*`. Count every way to fill them that gives a valid card,
grouped by network. Return lines `"NETWORK,count"` sorted by network name. Return `[]` if
none are valid. 5 stars means 100,000 fills, so keep the loop tight.

```
"4242424242424*42" -> ["VISA,1"]
"**55555555554444" -> ["MASTERCARD,1", "VISA,1"]
```

## Part 4 — `recover(card) -> list[str]`
The input ends with `?`: exactly one error happened while typing the card. Either **one
digit was changed**, or **two adjacent different digits were swapped**. Return every
possible valid original card as `"card,NETWORK"`, deduplicated and sorted in ascending
numeric order. The input itself is never a candidate, because an error definitely happened.

Note: several examples on the extrabrain page are wrong under the page's own Luhn rule.
It says `4425233430109994` is VISA, `3*8282246310005` gives `AMEX,2`, and it lists
invalid cards in its Part 4 example. With a single `*`, exactly one digit can satisfy
Luhn. These tests use values computed with standard Luhn.

Run: `python test.py` (your solution) or `python test.py ref` (reference).

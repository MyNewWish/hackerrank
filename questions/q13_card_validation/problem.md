# Payment card validation

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

## Input Format

1. An integer `Q`, the number of queries.
2. `Q` query lines `COMMAND card`. The command is one of `VISA`, `CLASSIFY`, `REDACTED`
   and `RECOVER`, described in the parts below. The card is the rest of the line; it
   contains no spaces and may be empty.

```
2
VISA 4242424242424242
CLASSIFY 378282246310005
```

## Output Format

One line per query, in order: the query's items separated by single spaces, or `NONE`
if there are no items.

```
VISA
AMEX
```

## Part 1 — Visa checksum

`VISA card`: the card is always 16 digits starting with `4`. Print `VISA` if Luhn
passes, otherwise `INVALID_CHECKSUM`.

Input:
```
2
VISA 4242424242424242
VISA 4242424242424243
```
Output:
```
VISA
INVALID_CHECKSUM
```

## Part 2 — Classify

`CLASSIFY card`: print the network name if the network matches and Luhn passes,
`INVALID_CHECKSUM` if the network matches but Luhn fails, and `UNKNOWN_NETWORK` if the
length or prefix matches no network, or the card isn't all digits (an empty card
included).

Input:
```
5
CLASSIFY 4242424242424242
CLASSIFY 378282246310005
CLASSIFY 5555555555554444
CLASSIFY 5555555555554445
CLASSIFY 5655555555554444
```
Output:
```
VISA
AMEX
MASTERCARD
INVALID_CHECKSUM
UNKNOWN_NETWORK
```

## Part 3 — Redacted digits

`REDACTED card`: 1 to 5 digits are replaced by `*`. Count every way to fill them that
gives a valid card (network matches and Luhn passes), grouped by network. Print items
`NETWORK,count` sorted by network name, or `NONE` if no fill is valid. 5 stars means
100,000 fills, so keep the loop tight.

Input:
```
2
REDACTED 4242424242424*42
REDACTED **55555555554444
```
Output:
```
VISA,1
MASTERCARD,1 VISA,1
```

With a single `*`, exactly one digit can satisfy Luhn.

## Part 4 — Typo recovery

`RECOVER card?`: the card ends with `?`, and exactly one error happened while typing it.
Either **one digit was changed**, or **two adjacent different digits were swapped**.
Print every possible valid original card (network matches and Luhn passes) as
`card,NETWORK`, deduplicated and sorted in ascending numeric order. The typed card itself
is never a candidate, because an error definitely happened.

Input:
```
1
RECOVER 378282246310050?
```
Output:
```
372282246310050,AMEX 378222246310050,AMEX 378282216310050,AMEX 378282240310050,AMEX 378282243610050,AMEX 378282246010050,AMEX 378282246310005,AMEX 378282246310054,AMEX 378282246310070,AMEX 378282246310450,AMEX 378282246310500,AMEX 378282246312050,AMEX 378282246350050,AMEX 378282646310050,AMEX 378284246310050,AMEX 378482246310050,AMEX
```

The true card is `378282246310005` with its last two digits swapped; the other 15 come
from changing one digit.

## Notes on the source

Several examples on the extrabrain page are wrong under the page's own Luhn rule. It says
`4425233430109994` is VISA, `3*8282246310005` gives `AMEX,2`, and it lists invalid cards
in its Part 4 example. The tests use values computed with standard Luhn.

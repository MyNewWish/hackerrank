import sys

# Correct sums, printed as floats with representation noise, e.g. 3 -> 3.0000000001
for line in sys.stdin:
    if line.strip():
        a, b = map(int, line.split())
        print(f"{a + b + 1e-10:.10f}")

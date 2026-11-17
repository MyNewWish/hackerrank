import sys

for line in sys.stdin:
    if line.strip():
        a, b = map(int, line.split())
        sys.stdout.write(f"{a + b}   \t\n")
sys.stdout.write("\n\n  \n")

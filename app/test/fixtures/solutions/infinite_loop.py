import os

# Record our pid so tests can check the process is really gone after a kill.
with open("solution.pid", "w") as f:
    f.write(str(os.getpid()))

while True:
    pass

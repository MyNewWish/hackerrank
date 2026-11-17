import subprocess
import sys

# A grandchild that inherits our stdout/stderr, like the real interpreter behind
# a Windows venv launcher. If only we are killed, it keeps the pipes open.
child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
with open("solution.pid", "w") as f:
    f.write(str(child.pid))

while True:
    pass

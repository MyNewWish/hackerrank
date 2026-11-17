import subprocess
import sys

# Exits straight away, leaving a grandchild that still holds our stdout/stderr open.
subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])

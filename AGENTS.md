# AGENTS.md

## Setting up and running the app

Do this when the user asks to set up, install, run or start the app, or a `bun` or `python` command fails because one of them is missing.

1. **Check the prerequisites**, each separately:
   - Python 3.10+: try `python --version`, then `python3 --version`, then (Windows) `py --version`.
   - Bun: `bun --version`.
2. **If one is missing or too old**, tell the user which, show the official install command for their OS,
   and **ask before running it**. Installing system tools is the user's call.
   - Bun on macOS/Linux: `curl -fsSL https://bun.sh/install | bash`
   - Bun on Windows (PowerShell): `powershell -c "irm bun.sh/install.ps1 | iex"`
   - Python on Windows: `winget install Python.Python.3.13`, or the installer from https://www.python.org/downloads/
   - Python on macOS: `brew install python`, or the installer from python.org
   - Python on Linux: the distro package, e.g. `sudo apt install python3`

   After installing, the user may have to open a new terminal so it's on `PATH`. Check again before you continue.
3. **Install and run** from `app/`: `bun install`, then `bun run dev`. Run `bun run dev` in the background, because it keeps running while the app is open.

The app looks for `python3`, `python`, then (Windows) `py -3` on `PATH`. `bun run gen` and `bun run validate` also accept `--python <path>`.

## Skills

Skills live in `skills/<name>/SKILL.md`. Read the whole file and follow it when its trigger applies.

- `skills/add-question/SKILL.md`: add a question to the practice bank (`questions/q<N>_<slug>`)
  from pasted problem text or a URL. Use when asked to add, import or create a bank question.

// Builds the app and packages it for the OS this runs on, into `release/`.
// Usage: bun run package [--dir]   (--dir: an unpacked app folder only, no installer)
const platformFlag = { win32: "--win", darwin: "--mac", linux: "--linux" }[process.platform as string];
if (!platformFlag) throw new Error(`packaging is not set up for ${process.platform}`);

function run(cmd: string[]): void {
  const { exitCode } = Bun.spawnSync(cmd, { stdio: ["inherit", "inherit", "inherit"] });
  if (exitCode !== 0) process.exit(exitCode ?? 1);
}

run(["bunx", "electron-vite", "build"]);
run(["bunx", "electron-builder", platformFlag, "--publish", "never", ...Bun.argv.slice(2)]);

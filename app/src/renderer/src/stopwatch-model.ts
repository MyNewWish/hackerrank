/** `ok` = on pace, `warn` = from 80% of the target time, `over` = past the target time. */
export type StopwatchLevel = "ok" | "warn" | "over";

const WARN_FRACTION = 0.8;

/** How `elapsedMs` compares with a question's target time. */
export function stopwatchLevel(elapsedMs: number, targetMinutes: number): StopwatchLevel {
  const targetMs = targetMinutes * 60_000;
  if (elapsedMs > targetMs) return "over";
  if (elapsedMs >= targetMs * WARN_FRACTION) return "warn";
  return "ok";
}

/** `m:ss`, or `h:mm:ss` from an hour on. */
export function formatElapsed(elapsedMs: number): string {
  const total = Math.floor(elapsedMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

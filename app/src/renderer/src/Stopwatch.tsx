import { useEffect, useState } from "react";
import { formatElapsed, stopwatchLevel } from "./stopwatch-model";

/**
 * The open question's time against its target: idle until `startedAt` (the first keystroke), then
 * ticking, amber from 80% of the target and red past it. It never stops a run or submits.
 */
export function Stopwatch({ startedAt, targetMinutes }: { startedAt: number | undefined; targetMinutes: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === undefined) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const target = `target ${targetMinutes} min`;
  if (startedAt === undefined) {
    return (
      <span className="stopwatch idle" title={`Starts on your first keystroke (${target})`}>
        {formatElapsed(0)}
      </span>
    );
  }
  const elapsed = Math.max(0, now - startedAt);
  const level = stopwatchLevel(elapsed, targetMinutes);
  return (
    <span className={`stopwatch ${level}`} title={target} role="timer">
      {formatElapsed(elapsed)}
    </span>
  );
}

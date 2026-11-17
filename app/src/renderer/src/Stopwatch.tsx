import { useEffect, useState } from "react";
import { formatElapsed, stopwatchLevel } from "./stopwatch-model";

/**
 * The attempt's time since `startedAt` (Start testing) against its target: amber from 80% of the
 * target and red past it. It never stops a run or submits.
 */
export function Stopwatch({ startedAt, targetMinutes }: { startedAt: number; targetMinutes: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const elapsed = Math.max(0, now - startedAt);
  const level = stopwatchLevel(elapsed, targetMinutes);
  return (
    <span className={`stopwatch ${level}`} title={`target ${targetMinutes} min`} role="timer">
      {formatElapsed(elapsed)}
    </span>
  );
}

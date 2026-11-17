import { describe, expect, test } from "bun:test";
import { formatElapsed, stopwatchLevel } from "../src/renderer/src/stopwatch-model";

const MIN = 60_000;

describe("stopwatch", () => {
  test("is on pace below 80% of the target, amber from 80% up to the target, red past it", () => {
    // A 10-minute target: amber from 8:00, red after 10:00.
    expect(stopwatchLevel(0, 10)).toBe("ok");
    expect(stopwatchLevel(8 * MIN - 1, 10)).toBe("ok");
    expect(stopwatchLevel(8 * MIN, 10)).toBe("warn");
    expect(stopwatchLevel(10 * MIN, 10)).toBe("warn");
    expect(stopwatchLevel(10 * MIN + 1, 10)).toBe("over");
  });

  test("works with a short, fractional target time", () => {
    // 0.5 minutes = 30 s: amber from 24 s, red after 30 s.
    expect(stopwatchLevel(23_999, 0.5)).toBe("ok");
    expect(stopwatchLevel(24_000, 0.5)).toBe("warn");
    expect(stopwatchLevel(30_001, 0.5)).toBe("over");
  });

  test("shows minutes and seconds, and hours once past an hour", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(9_999)).toBe("0:09");
    expect(formatElapsed(12 * MIN + 5_000)).toBe("12:05");
    expect(formatElapsed(61 * MIN + 2_000)).toBe("1:01:02");
  });
});

import { describe, expect, it } from "vitest";

import { evaluateDeadlineWarning } from "@/lib/server/time-guardian/deadline-warning-engine";

describe("deadline warning engine", () => {
  it("returns none when remaining time is comfortably above estimated work", () => {
    const warning = evaluateDeadlineWarning({
      now: "2026-05-21T12:00:00+08:00",
      dueAt: "2026-05-21T20:00:00+08:00",
      remainingEstimatedMinutes: 60,
      fixedBusyWindows: [],
      safetyBufferMinutes: 30,
      affectedCardIds: ["card_1"],
      estimateConfidence: 0.8,
    });

    expect(warning.level).toBe("none");
  });

  it("returns risk when fixed class time squeezes available slack", () => {
    const warning = evaluateDeadlineWarning({
      now: "2026-05-21T18:00:00+08:00",
      dueAt: "2026-05-21T20:00:00+08:00",
      remainingEstimatedMinutes: 55,
      fixedBusyWindows: [
        {
          startsAt: "2026-05-21T18:30:00+08:00",
          endsAt: "2026-05-21T19:20:00+08:00",
        },
      ],
      safetyBufferMinutes: 10,
      affectedCardIds: ["card_submit"],
      estimateConfidence: 0.7,
    });

    expect(warning.level).toBe("risk");
    expect(warning.suggestedRecoveryOptions.length).toBeGreaterThan(0);
  });

  it("returns critical when the minimum executable work no longer fits", () => {
    const warning = evaluateDeadlineWarning({
      now: "2026-05-21T19:40:00+08:00",
      dueAt: "2026-05-21T20:00:00+08:00",
      remainingEstimatedMinutes: 30,
      fixedBusyWindows: [],
      safetyBufferMinutes: 0,
      affectedCardIds: ["card_submit"],
      estimateConfidence: 0.8,
    });

    expect(warning.level).toBe("critical");
  });
});

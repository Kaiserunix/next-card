import { describe, expect, it } from "vitest";

import { calculateDeadlineSlackMinutes } from "@/lib/server/time-guardian/slack-calculator";

describe("deadline slack calculator", () => {
  it("subtracts fixed busy time and safety buffer from deadline slack", () => {
    const result = calculateDeadlineSlackMinutes({
      now: "2026-05-21T18:00:00+08:00",
      dueAt: "2026-05-21T20:00:00+08:00",
      remainingEstimatedMinutes: 60,
      fixedBusyWindows: [
        {
          startsAt: "2026-05-21T18:30:00+08:00",
          endsAt: "2026-05-21T19:00:00+08:00",
        },
      ],
      safetyBufferMinutes: 15,
    });

    expect(result.availableMinutes).toBe(75);
    expect(result.slackMinutes).toBe(15);
  });
});

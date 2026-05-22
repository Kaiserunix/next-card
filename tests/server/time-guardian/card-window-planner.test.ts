import { describe, expect, it } from "vitest";

import { planCardWindows } from "@/lib/server/time-guardian/card-window-planner";
import { committedCard, lockedBlock, snapshot, timeWindow } from "./test-utils";

describe("card window planner", () => {
  it("uses the preferred safe window before a verified 08:00 class", () => {
    const current = snapshot();
    const result = planCardWindows({
      snapshot: current,
      cards: [committedCard()],
      chosenPlanId: "plan-b",
    });

    expect(result.placements).toHaveLength(1);
    expect(result.placements[0].window.startAt).toBe("2026-05-21T07:25:00+08:00");
    expect(result.placements[0].window.endAt).toBe("2026-05-20T23:40:00.000Z");
    expect(result.conflicts).toHaveLength(0);
  });

  it("does not insert soft tasks into a user locked block", () => {
    const current = snapshot({
      timeLocks: [lockedBlock()],
      availableWindows: [timeWindow("locked_candidate", "2026-05-21T12:00:00+08:00", "2026-05-21T13:00:00+08:00")],
    });

    const result = planCardWindows({
      snapshot: current,
      cards: [
        committedCard({
          cardId: "card_soft_review",
          tension: "soft",
          estimatedMinutes: 20,
          preferredStartAt: "2026-05-21T12:10:00+08:00",
        }),
      ],
      chosenPlanId: "plan-b",
    });

    expect(result.placements).toHaveLength(0);
    expect(result.conflicts[0].reason).toContain("user_locked_block");
  });
});

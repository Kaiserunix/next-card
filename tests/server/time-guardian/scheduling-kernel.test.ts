import { describe, expect, it } from "vitest";

import { scheduleCommittedDeck } from "@/lib/server/time-guardian/scheduling-kernel";
import { committedCard, committedDeck, snapshot, submissionDeadline, timeWindow } from "./test-utils";

describe("scheduling kernel", () => {
  it("schedules only the selected plan and emits internal card-window actions", () => {
    const current = snapshot();
    const result = scheduleCommittedDeck({
      snapshot: current,
      deck: committedDeck({ chosenPlanId: "plan-c" }),
      chosenPlanId: "plan-c",
      cards: [
        committedCard({ cardId: "card_a", chosenPlanId: "plan-a" }),
        committedCard({ cardId: "card_c", chosenPlanId: "plan-c", preferredStartAt: "2026-05-21T07:20:00+08:00" }),
      ],
    });

    expect(result.queueActions).toHaveLength(1);
    expect(result.queueActions[0]).toMatchObject({
      type: "insert-schedule-event",
      actor: "system-service",
    });
    if (result.queueActions[0].type === "insert-schedule-event") {
      expect(result.queueActions[0].event.cardId).toBe("card_c");
      expect(result.queueActions[0].event.kind).toBe("card-window");
    }
  });

  it("prioritizes deadline-sensitive cards before soft review cards", () => {
    const current = snapshot({
      timeLocks: [submissionDeadline()],
      availableWindows: [timeWindow("evening", "2026-05-21T19:00:00+08:00", "2026-05-21T20:00:00+08:00")],
    });
    const result = scheduleCommittedDeck({
      snapshot: current,
      deck: committedDeck(),
      chosenPlanId: "plan-b",
      cards: [
        committedCard({ cardId: "card_soft_review", tension: "soft", estimatedMinutes: 20 }),
        committedCard({ cardId: "card_submit_minimum", tension: "deadline-sensitive", estimatedMinutes: 20 }),
      ],
    });

    expect(result.scheduleProposal.placements[0].cardId).toBe("card_submit_minimum");
  });

  it("returns a review action when no safe window exists", () => {
    const current = snapshot({ availableWindows: [] });
    const result = scheduleCommittedDeck({
      snapshot: current,
      deck: committedDeck(),
      chosenPlanId: "plan-b",
      cards: [committedCard()],
    });

    expect(result.queueActions.some((action) => action.type === "request-user-review")).toBe(true);
    expect(result.warnings[0]).toContain("No safe window");
  });
});

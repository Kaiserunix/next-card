import { describe, expect, it } from "vitest";

import { createBaselineReminderPlan } from "@/lib/server/time-guardian/reminder-baseline-service";

describe("baseline reminder service", () => {
  it("creates the default 30 minute baseline reminder before target time", () => {
    const plan = createBaselineReminderPlan({
      id: "baseline_8am",
      cardId: "card_prepare",
      deckId: "deck_calculus",
      chosenPlanId: "plan-b",
      targetTime: "2026-05-21T08:00:00+08:00",
      now: "2026-05-21T07:00:00+08:00",
    });

    expect(plan.fireAt).toBe("2026-05-20T23:30:00.000Z");
    expect(plan.kind).toBe("baseline");
    expect(plan.source).toBe("system-fallback");
  });

  it("respects user lead minutes", () => {
    const plan = createBaselineReminderPlan({
      id: "baseline_15",
      cardId: "card_prepare",
      deckId: "deck_calculus",
      chosenPlanId: "plan-b",
      targetTime: "2026-05-21T08:00:00+08:00",
      now: "2026-05-21T07:00:00+08:00",
      leadMinutes: 15,
    });

    expect(plan.fireAt).toBe("2026-05-20T23:45:00.000Z");
  });

  it("fires immediately if less time remains than the lead time", () => {
    const plan = createBaselineReminderPlan({
      id: "baseline_now",
      cardId: "card_prepare",
      deckId: "deck_calculus",
      chosenPlanId: "plan-b",
      targetTime: "2026-05-21T08:00:00+08:00",
      now: "2026-05-21T07:50:00+08:00",
      leadMinutes: 30,
    });

    expect(plan.fireAt).toBe("2026-05-20T23:50:00.000Z");
    expect(plan.reason).toContain("Less time remains");
  });
});

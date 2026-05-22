import { describe, expect, it } from "vitest";

import { createRecoveryReviewAction } from "@/lib/server/time-guardian/recovery-request-service";
import { evaluateDeadlineWarning } from "@/lib/server/time-guardian/deadline-warning-engine";
import { snapshot } from "./test-utils";

describe("recovery request service", () => {
  it("asks for recovery review without reducing baseline or standard goals", () => {
    const current = snapshot();
    const goalContract = {
      id: "goal_1",
      deckId: "deck_calculus",
      baselineGoal: { description: "Arrive for class.", autoReducible: false as const },
      standardGoal: { description: "Attend with materials.", autoReducible: false as const },
      progressGoal: { description: "Pack materials.", canShrinkForActivation: true as const },
      qualityDebt: [],
    };
    const warning = evaluateDeadlineWarning({
      now: "2026-05-21T19:45:00+08:00",
      dueAt: "2026-05-21T20:00:00+08:00",
      remainingEstimatedMinutes: 30,
      fixedBusyWindows: [],
      safetyBufferMinutes: 0,
      affectedCardIds: ["card_submit"],
      estimateConfidence: 0.8,
    });

    const action = createRecoveryReviewAction({
      snapshot: current,
      warning,
      goalContract,
      createdAt: current.now,
    });

    expect(action.type).toBe("request-user-review");
    expect(goalContract.baselineGoal.autoReducible).toBe(false);
    expect(goalContract.standardGoal.autoReducible).toBe(false);
    expect(action.recoveryOptions.map((option) => option.kind as string)).not.toContain("delete-goal");
  });
});

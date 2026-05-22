import { describe, expect, it } from "vitest";

import { chooseFrozenQueuePolicy } from "@/lib/server/time-guardian/frozen-queue-policy";
import { frozenItem, snapshot, timeWindow } from "./test-utils";

describe("frozen queue policy", () => {
  it("plans same-day reinsertion when a safe window exists", () => {
    const policy = chooseFrozenQueuePolicy({
      snapshot: snapshot({
        availableWindows: [timeWindow("later", "2026-05-21T10:00:00+08:00", "2026-05-21T10:30:00+08:00")],
      }),
      item: frozenItem(),
    });

    expect(policy.decision).toBe("reinsert-today");
  });

  it("asks for review when deadline risk has changed", () => {
    const policy = chooseFrozenQueuePolicy({
      snapshot: snapshot(),
      item: frozenItem(),
      deadlineWarning: {
        level: "critical",
        reason: "Minimum action no longer fits before deadline.",
        affectedCardIds: ["card_prepare"],
        suggestedRecoveryOptions: [],
      },
    });

    expect(policy.decision).toBe("needs-review");
  });
});

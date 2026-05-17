import { describe, expect, it } from "vitest";
import { createSchedulePlan } from "@/lib/server/schedule-planner";
import type { QueueItem, TimeLock } from "@/lib/types";

const now = "2026-05-17T12:00:00.000Z";

describe("createSchedulePlan", () => {
  it("preserves colliding hard-locked queue positions without dropping locked items", () => {
    const first = queueItem("locked-a", { position: 0, timeLocks: [hardLock("lock-a", "locked-a")] });
    const second = queueItem("locked-b", { position: 0, timeLocks: [hardLock("lock-b", "locked-b")] });
    const flexible = queueItem("flexible", { urgencyStage: "burning" });

    const result = createSchedulePlan({
      now,
      items: [first, second, flexible],
      activeQueue: [],
      timeLocks: [],
      maxDealCards: 2
    });

    expect(result.orderedQueue).toEqual(expect.arrayContaining(["locked-a", "locked-b", "flexible"]));
    expect(new Set(result.orderedQueue).size).toBe(3);
    expect(result.actions.every((action) => action.position === undefined || action.position >= 0)).toBe(true);
  });
});

function queueItem(id: string, overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id,
    title: id,
    kind: "card",
    status: "queued",
    source: "text",
    createdAt: now,
    estimatedMinutes: 10,
    urgencyStage: "warm",
    timeLocks: [],
    ...overrides
  };
}

function hardLock(id: string, targetId: string): TimeLock {
  return {
    id,
    targetId,
    targetType: "card",
    kind: "user-fixed",
    strength: "hard",
    lockedAt: now,
    reason: "user fixed",
    canAgentMove: false,
    canAgentSuggest: true
  };
}

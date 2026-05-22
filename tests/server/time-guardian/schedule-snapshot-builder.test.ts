import { describe, expect, it } from "vitest";

import { buildScheduleSnapshot } from "@/lib/server/time-guardian/schedule-snapshot-builder";
import { classLock, committedDeck, NOW, scheduledCard, timeWindow, TZ } from "./test-utils";

describe("buildScheduleSnapshot", () => {
  it("creates a versioned read-only snapshot with a stable id for the same time world", () => {
    const input = {
      now: NOW,
      timezone: TZ,
      committedDecks: [committedDeck()],
      activeCards: [scheduledCard()],
      scheduledEvents: [],
      timeLocks: [classLock()],
      availableWindows: [timeWindow("window_morning", "2026-05-21T07:00:00+08:00", "2026-05-21T08:00:00+08:00")],
      frozenQueue: [],
      policySnapshotId: "policy_default",
    };

    const first = buildScheduleSnapshot(input).snapshot;
    const second = buildScheduleSnapshot(input).snapshot;

    expect(first.id).toMatch(/^snapshot_/);
    expect(first.id).toBe(second.id);
    expect(first.version).toBe(1);
    expect(first.timeLocks[0].movable).toBe(false);
  });
});

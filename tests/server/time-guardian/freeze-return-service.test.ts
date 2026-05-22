import { describe, expect, it } from "vitest";

import { planFreezeReturn } from "@/lib/server/time-guardian/freeze-return-service";
import { frozenItem, snapshot, timeWindow } from "./test-utils";

describe("freeze return service", () => {
  it("returns a frozen card through review without deleting or failing it", () => {
    const current = snapshot({
      frozenQueue: [frozenItem()],
      availableWindows: [timeWindow("return", "2026-05-21T10:00:00+08:00", "2026-05-21T10:20:00+08:00")],
    });
    const result = planFreezeReturn({
      snapshot: current,
      item: frozenItem(),
      createdAt: current.now,
    });

    expect(result.actions.some((action) => action.type === "reinsert-frozen-card")).toBe(true);
    expect(result.actions.some((action) => action.type === "insert-schedule-event")).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/delete|failed/i);
  });

  it("requests user review when hard locks block reinsertion", () => {
    const current = snapshot({
      frozenQueue: [frozenItem()],
      availableWindows: [timeWindow("class_conflict", "2026-05-21T08:00:00+08:00", "2026-05-21T08:20:00+08:00")],
    });
    const result = planFreezeReturn({
      snapshot: current,
      item: frozenItem(),
      createdAt: current.now,
    });

    expect(result.actions.some((action) => action.type === "request-user-review")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { createSoftTaskSurfaceActions } from "@/lib/server/time-guardian/soft-task-surface-service";
import { committedCard, lockedBlock, snapshot, timeWindow } from "./test-utils";

describe("soft task surface service", () => {
  it("emits a gentle soft-task-surface event after the good line", () => {
    const current = snapshot({
      now: "2026-05-21T12:10:00+08:00",
      availableWindows: [timeWindow("after_good_line", "2026-05-21T12:10:00+08:00", "2026-05-21T12:30:00+08:00")],
      timeLocks: [],
    });
    const result = createSoftTaskSurfaceActions({
      snapshot: current,
      card: committedCard({ cardId: "card_preview", tension: "soft", estimatedMinutes: 10 }),
      timing: {
        recommendedGoodLineAt: "2026-05-21T12:00:00+08:00",
        mustNudgeAfterAt: "2026-05-21T15:00:00+08:00",
        hardensAt: "2026-05-21T18:00:00+08:00",
        deadlineAt: "2026-05-21T20:00:00+08:00",
        reason: "Preview is useful before evening.",
      },
      createdAt: current.now,
    });

    expect(result.actions.some((action) => action.type === "insert-schedule-event")).toBe(true);
    expect(result.userVisibleCopy).not.toMatch(/lazy|failure|failed/i);
  });

  it("does not surface soft tasks inside user locked time", () => {
    const current = snapshot({
      now: "2026-05-21T12:10:00+08:00",
      timeLocks: [lockedBlock()],
      availableWindows: [timeWindow("locked", "2026-05-21T12:00:00+08:00", "2026-05-21T13:00:00+08:00")],
    });
    const result = createSoftTaskSurfaceActions({
      snapshot: current,
      card: committedCard({ cardId: "card_preview", tension: "soft", estimatedMinutes: 10 }),
      timing: {
        recommendedGoodLineAt: "2026-05-21T12:00:00+08:00",
        mustNudgeAfterAt: "2026-05-21T15:00:00+08:00",
        hardensAt: "2026-05-21T18:00:00+08:00",
        deadlineAt: "2026-05-21T20:00:00+08:00",
        reason: "Preview is useful before evening.",
      },
      createdAt: current.now,
    });

    expect(result.actions.every((action) => action.type !== "insert-schedule-event")).toBe(true);
    expect(result.actions.some((action) => action.type === "request-user-review")).toBe(true);
  });
});

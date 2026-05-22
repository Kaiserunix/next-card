import { describe, expect, it } from "vitest";

import { evaluateSoftTaskGoodLine } from "@/lib/server/time-guardian/soft-task-good-line";

describe("soft task good line", () => {
  it("keeps a preparation task optional before the good line", () => {
    const result = evaluateSoftTaskGoodLine({
      now: "2026-05-21T09:00:00+08:00",
      timing: {
        recommendedGoodLineAt: "2026-05-21T12:00:00+08:00",
        mustNudgeAfterAt: "2026-05-21T15:00:00+08:00",
        hardensAt: "2026-05-21T18:00:00+08:00",
        deadlineAt: "2026-05-21T20:00:00+08:00",
        reason: "Review is flexible until noon.",
      },
    });

    expect(result.phase).toBe("optional");
    expect(result.nextTension).toBe("soft");
  });

  it("allows a gentle nudge at the good line", () => {
    const result = evaluateSoftTaskGoodLine({
      now: "2026-05-21T12:00:00+08:00",
      timing: {
        recommendedGoodLineAt: "2026-05-21T12:00:00+08:00",
        mustNudgeAfterAt: "2026-05-21T15:00:00+08:00",
        hardensAt: "2026-05-21T18:00:00+08:00",
        deadlineAt: "2026-05-21T20:00:00+08:00",
        reason: "Review is now useful.",
      },
    });

    expect(result.phase).toBe("gentle-nudge");
    expect(result.nextTension).toBe("recommended");
  });
});

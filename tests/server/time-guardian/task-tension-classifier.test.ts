import { describe, expect, it } from "vitest";

import { classifyTaskTension } from "@/lib/server/time-guardian/task-tension-classifier";

describe("task tension classifier", () => {
  it("classifies class and exam facts as hard", () => {
    const result = classifyTaskTension({
      timeLockKind: "class_time",
      now: "2026-05-21T07:00:00+08:00",
    });

    expect(result.tension).toBe("hard");
    expect(result.reason).toContain("class_time");
  });

  it("keeps Agent3 generated system tasks soft by default", () => {
    const result = classifyTaskTension({
      generatedBy: "action-review",
      now: "2026-05-21T07:00:00+08:00",
    });

    expect(result.tension).toBe("soft");
    expect(result.reason).not.toMatch(/lazy|failure|self-discipline/i);
  });

  it("turns a soft task deadline-sensitive after hardensAt with an explainable reason", () => {
    const result = classifyTaskTension({
      now: "2026-05-21T18:00:00+08:00",
      softTaskTiming: {
        recommendedGoodLineAt: "2026-05-21T12:00:00+08:00",
        mustNudgeAfterAt: "2026-05-21T15:00:00+08:00",
        hardensAt: "2026-05-21T17:00:00+08:00",
        deadlineAt: "2026-05-21T20:00:00+08:00",
        reason: "Assignment is nearing its latest safe start.",
      },
    });

    expect(result.tension).toBe("deadline-sensitive");
    expect(result.reason).toContain("hardensAt");
  });
});

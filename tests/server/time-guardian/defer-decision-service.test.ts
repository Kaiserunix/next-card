import { describe, expect, it } from "vitest";

import { decideDeferCard } from "@/lib/server/time-guardian/defer-decision-service";
import { committedCard, snapshot, timeWindow } from "./test-utils";

describe("defer decision service", () => {
  it("allows safe defers and returns a DeferCardAction", () => {
    const current = snapshot({
      availableWindows: [timeWindow("safe", "2026-05-21T07:10:00+08:00", "2026-05-21T07:25:00+08:00")],
    });
    const result = decideDeferCard({
      snapshot: current,
      card: committedCard(),
      toWindow: timeWindow("safe", "2026-05-21T07:10:00+08:00", "2026-05-21T07:25:00+08:00"),
    });

    expect(result.action.type).toBe("defer-card");
  });

  it("asks for review when a defer lands inside an exam or class time", () => {
    const current = snapshot();
    const result = decideDeferCard({
      snapshot: current,
      card: committedCard(),
      toWindow: timeWindow("unsafe", "2026-05-21T08:10:00+08:00", "2026-05-21T08:25:00+08:00"),
    });

    expect(result.action.type).toBe("request-user-review");
    expect(result.reason).toContain("class_time");
  });
});

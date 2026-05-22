import { describe, expect, it } from "vitest";

import { compareIso, rangesOverlap } from "@/lib/server/time-guardian/time-overlap";

describe("time overlap helpers", () => {
  it("treats adjacent windows as non-overlapping", () => {
    expect(
      rangesOverlap(
        "2026-05-21T07:25:00+08:00",
        "2026-05-21T07:40:00+08:00",
        "2026-05-21T07:40:00+08:00",
        "2026-05-21T08:00:00+08:00",
      ),
    ).toBe(false);
  });

  it("detects actual overlap using absolute time", () => {
    expect(
      rangesOverlap(
        "2026-05-21T08:20:00+08:00",
        "2026-05-21T08:40:00+08:00",
        "2026-05-21T08:00:00+08:00",
        "2026-05-21T09:30:00+08:00",
      ),
    ).toBe(true);
  });

  it("compares ISO timestamps with offsets", () => {
    expect(compareIso("2026-05-21T08:00:00+08:00", "2026-05-21T00:30:00Z")).toBeLessThan(0);
  });
});

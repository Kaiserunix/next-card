import { describe, expect, it } from "vitest";

import { buildDefaultProfile } from "@/lib/server/action-review/profile-aggregator";
import { buildPolicySnapshot } from "@/lib/server/action-review/policy-engine";
import { expectForbiddenKeysAbsent } from "./test-utils";

describe("policy engine", () => {
  it("builds a versioned future-facing default-balanced policy", () => {
    const profile = buildDefaultProfile("user-demo", "2026-05-21T12:00:00.000Z");
    const policy = buildPolicySnapshot(profile, {
      preset: "default-balanced",
      now: "2026-05-21T12:05:00.000Z",
    });

    expect(policy.appliesTo).toBe("future-planning-only");
    expect(policy.version).toBe(1);
    expect(policy.planIntensity).toBe("balanced");
    expect(policy.cardGranularity).toBe("standard");
    expect(policy.reminderStrictness).toBe("normal");
    expectForbiddenKeysAbsent(policy);
  });

  it("maps explicit rhythm presets to future hints, not active state changes", () => {
    const profile = buildDefaultProfile("user-demo", "2026-05-21T12:00:00.000Z");

    expect(buildPolicySnapshot(profile, { preset: "low-pressure-start" }).cardGranularity).toBe("micro");
    expect(buildPolicySnapshot(profile, { preset: "short-card-focus" }).cardMinuteRange).toEqual([5, 12]);
    expect(buildPolicySnapshot(profile, { preset: "more-buffer" }).bufferMultiplier).toBeGreaterThan(1);
    expect(buildPolicySnapshot(profile, { preset: "light-reminders" }).nudgeDailyCap).toBeLessThan(2);
  });

  it("cannot express TimeLock moves, baseline reminder deletion, or goal reduction", () => {
    const profile = buildDefaultProfile("user-demo", "2026-05-21T12:00:00.000Z");
    const policy = buildPolicySnapshot(profile, { preset: "more-buffer" });

    expect(policy.allowedInfluence).toEqual(
      expect.arrayContaining(["future-first-card-size", "future-buffer-size", "future-reminder-tone"]),
    );
    expect(policy.forbiddenInfluence).toEqual(
      expect.arrayContaining(["deadline", "hard-lock", "baseline-reminder-existence"]),
    );
    expectForbiddenKeysAbsent(policy);
  });
});

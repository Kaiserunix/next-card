import { describe, expect, it } from "vitest";

import {
  buildDefaultGovernanceSettings,
  createProfileCandidate,
  disablePersonalization,
  enablePersonalization,
  resetProfile,
} from "@/lib/server/action-review/profile-governance";
import { buildDefaultProfile } from "@/lib/server/action-review/profile-aggregator";
import type { ProofSignalAggregate } from "@/lib/server/action-review/types";

describe("profile governance", () => {
  it("defaults personalization and automatic updates to off", () => {
    const settings = buildDefaultGovernanceSettings("user-demo", "2026-05-21T12:00:00.000Z");

    expect(settings.personalizationEnabled).toBe(false);
    expect(settings.autoUpdateEnabled).toBe(false);
    expect(settings.evidenceWindowDays).toBe(14);
    expect(settings.experimentFlags).toEqual([]);
  });

  it("can explicitly enable and disable personalization without deleting proof", () => {
    const settings = buildDefaultGovernanceSettings("user-demo", "2026-05-21T12:00:00.000Z");
    const enabled = enablePersonalization(settings, { autoUpdateEnabled: true, now: "2026-05-21T13:00:00.000Z" });
    const disabled = disablePersonalization(enabled, "2026-05-21T14:00:00.000Z");

    expect(enabled.personalizationEnabled).toBe(true);
    expect(enabled.autoUpdateEnabled).toBe(true);
    expect(disabled.personalizationEnabled).toBe(false);
    expect(disabled.autoUpdateEnabled).toBe(false);
  });

  it("resets profile to unknown dimensions and increments the version", () => {
    const previous = {
      ...buildDefaultProfile("user-demo"),
      version: 3,
      mode: "candidate" as const,
      confidence: 0.5,
      evidenceIds: ["evt_a"],
    };

    const reset = resetProfile("user-demo", previous, "2026-05-21T15:00:00.000Z");

    expect(reset.version).toBe(4);
    expect(reset.mode).toBe("default");
    expect(reset.confidence).toBe(0);
    expect(reset.evidenceIds).toEqual([]);
    expect(Object.values(reset.dimensions).every((dimension) => dimension.value === "unknown")).toBe(true);
  });

  it("does not create an active inferred profile when personalization is disabled", () => {
    const previous = buildDefaultProfile("user-demo");
    const settings = buildDefaultGovernanceSettings("user-demo");

    const profile = createProfileCandidate(settings, makeAggregate(8), previous, "2026-05-21T16:00:00.000Z");

    expect(profile).toEqual(previous);
    expect(profile.mode).not.toBe("active");
  });

  it("creates a candidate, not active profile, for low confidence evidence", () => {
    const previous = buildDefaultProfile("user-demo");
    const settings = enablePersonalization(buildDefaultGovernanceSettings("user-demo"), {
      autoUpdateEnabled: true,
    });

    const profile = createProfileCandidate(settings, makeAggregate(2), previous, "2026-05-21T16:00:00.000Z");

    expect(profile.mode).toBe("candidate");
    expect(profile.mode).not.toBe("active");
  });
});

function makeAggregate(evidenceCount: number): ProofSignalAggregate {
  return {
    id: "aggregate_governance",
    userId: "user-demo",
    windowDays: 14,
    createdAt: "2026-05-21T12:00:00.000Z",
    evidenceEventIds: Array.from({ length: evidenceCount }, (_, index) => `evt_${index}`),
    signals: {
      firstCardStartDelayMinutes: 20,
      actualVsEstimatedRatio: 1.4,
      freezeRate: 0.35,
    },
    dataQuality: {
      evidenceCount,
      reminderDeliveryReliable: true,
      hasEnoughData: evidenceCount >= 3,
    },
  };
}

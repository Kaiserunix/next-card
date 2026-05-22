import { describe, expect, it } from "vitest";

import { buildDefaultProfile, aggregateProfile } from "@/lib/server/action-review/profile-aggregator";
import type { ProofSignalAggregate } from "@/lib/server/action-review/types";

describe("profile aggregator", () => {
  it("builds a default profile with unknown dimensions and zero confidence", () => {
    const profile = buildDefaultProfile("user-demo", "2026-05-21T12:00:00.000Z");

    expect(profile.mode).toBe("default");
    expect(profile.confidence).toBe(0);
    expect(profile.evidenceIds).toEqual([]);
    expect(profile.userEditable).toBe(true);
    expect(profile.resettable).toBe(true);
    expect(Object.values(profile.dimensions).every((dimension) => dimension.value === "unknown")).toBe(true);
  });

  it("returns the previous/default profile when automatic updates are off", () => {
    const previous = buildDefaultProfile("user-demo", "2026-05-21T12:00:00.000Z");
    const aggregate = makeAggregate(8);

    const profile = aggregateProfile(aggregate, previous, {
      personalizationEnabled: true,
      autoUpdateEnabled: false,
      now: "2026-05-21T13:00:00.000Z",
    });

    expect(profile).toEqual(previous);
  });

  it("creates only a candidate profile when personalization is explicitly enabled", () => {
    const previous = buildDefaultProfile("user-demo", "2026-05-21T12:00:00.000Z");
    const aggregate = makeAggregate(8);

    const profile = aggregateProfile(aggregate, previous, {
      personalizationEnabled: true,
      autoUpdateEnabled: true,
      now: "2026-05-21T13:00:00.000Z",
    });

    expect(profile.mode).toBe("candidate");
    expect(profile.version).toBe(previous.version + 1);
    expect(profile.confidence).toBeGreaterThan(0);
    expect(profile.evidenceIds).toEqual(aggregate.evidenceEventIds);
  });
});

function makeAggregate(evidenceCount: number): ProofSignalAggregate {
  return {
    id: "aggregate_demo",
    userId: "user-demo",
    windowDays: 14,
    createdAt: "2026-05-21T12:00:00.000Z",
    evidenceEventIds: Array.from({ length: evidenceCount }, (_, index) => `evt_${index}`),
    signals: {
      firstCardStartDelayMinutes: 18,
      actualVsEstimatedRatio: 1.35,
      freezeRate: 0.25,
      burnCompletionRate: 0.5,
      deliveredReminderResponseRate: 0.75,
      shortCardCompletionRate: 0.8,
    },
    dataQuality: {
      evidenceCount,
      reminderDeliveryReliable: true,
      hasEnoughData: evidenceCount >= 3,
    },
  };
}

import { describe, expect, it } from "vitest";

import { buildDefaultProfile } from "@/lib/server/action-review/profile-aggregator";
import { buildPolicySnapshot } from "@/lib/server/action-review/policy-engine";
import { buildProofSummaryInsight } from "@/lib/server/action-review/proof-summary-insight";
import { generateSoftTaskCandidates } from "@/lib/server/action-review/system-soft-task-candidates";
import type { ProfileSnapshot, ProofSignalAggregate } from "@/lib/server/action-review/types";
import { expectForbiddenKeysAbsent, expectSupportCopy } from "./test-utils";

describe("generateSoftTaskCandidates", () => {
  it("does not generate personalized candidates without evidence", () => {
    const profile = buildDefaultProfile("user-demo");
    const policy = buildPolicySnapshot(profile);
    const insight = buildProofSummaryInsight(makeAggregate(0), profile, policy);

    expect(generateSoftTaskCandidates(profile, insight)).toEqual([]);
  });

  it("generates only soft candidates that require Time Guardian review", () => {
    const profile = makeCandidateProfile();
    const policy = buildPolicySnapshot(profile, { preset: "short-card-focus" });
    const insight = buildProofSummaryInsight(makeAggregate(6), profile, policy);

    const candidates = generateSoftTaskCandidates(profile, insight);

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.defaultTension).toBe("soft");
      expect(candidate.requiresTimeGuardianReview).toBe(true);
      expect(candidate.evidenceIds.length).toBeGreaterThan(0);
      expectForbiddenKeysAbsent(candidate);
      expectSupportCopy(candidate);
    }
  });

  it("does not generate profile-based candidates when personalization is disabled/default", () => {
    const profile = buildDefaultProfile("user-demo");
    const policy = buildPolicySnapshot(profile);
    const insight = buildProofSummaryInsight(makeAggregate(6), profile, policy);

    expect(generateSoftTaskCandidates(profile, insight)).toEqual([]);
  });
});

function makeAggregate(evidenceCount: number): ProofSignalAggregate {
  return {
    id: "aggregate_candidates",
    userId: "user-demo",
    windowDays: 14,
    createdAt: "2026-05-21T12:00:00.000Z",
    evidenceEventIds: Array.from({ length: evidenceCount }, (_, index) => `evt_${index}`),
    signals: {
      freezeRate: 0.4,
      burnCompletionRate: 0.5,
      shortCardCompletionRate: 0.9,
      recoveryAfterFreezeMedianMinutes: 90,
    },
    dataQuality: {
      evidenceCount,
      reminderDeliveryReliable: true,
      hasEnoughData: evidenceCount >= 3,
    },
  };
}

function makeCandidateProfile(): ProfileSnapshot {
  const base = buildDefaultProfile("user-demo");
  return {
    ...base,
    id: "profile_candidate",
    mode: "candidate",
    confidence: 0.42,
    evidenceIds: ["evt_0", "evt_1", "evt_2", "evt_3"],
  };
}

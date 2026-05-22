import { describe, expect, it } from "vitest";

import { buildDefaultProfile } from "@/lib/server/action-review/profile-aggregator";
import { buildPolicySnapshot } from "@/lib/server/action-review/policy-engine";
import { buildProofSummaryInsight } from "@/lib/server/action-review/proof-summary-insight";
import type { ProofSignalAggregate } from "@/lib/server/action-review/types";
import { expectSupportCopy } from "./test-utils";

describe("buildProofSummaryInsight", () => {
  it("uses neutral empty-state wording without inferring habits", () => {
    const profile = buildDefaultProfile("user-demo");
    const policy = buildPolicySnapshot(profile);
    const insight = buildProofSummaryInsight(makeAggregate(0), profile, policy);

    expect(insight.summary).toContain("还没有足够");
    expect(insight.highlights).toEqual([]);
    expectSupportCopy(insight);
  });

  it("summarizes proof patterns as action support, not psychological judgment", () => {
    const profile = buildDefaultProfile("user-demo");
    const policy = buildPolicySnapshot(profile, { preset: "short-card-focus" });
    const insight = buildProofSummaryInsight(makeAggregate(6), profile, policy);

    expect(insight.highlights.length).toBeGreaterThan(0);
    expect(insight.nextSupportSuggestion).toContain("短卡");
    expectSupportCopy(insight);
  });
});

function makeAggregate(evidenceCount: number): ProofSignalAggregate {
  return {
    id: "aggregate_summary",
    userId: "user-demo",
    windowDays: 14,
    createdAt: "2026-05-21T12:00:00.000Z",
    evidenceEventIds: Array.from({ length: evidenceCount }, (_, index) => `evt_${index}`),
    signals:
      evidenceCount > 0
        ? {
            freezeRate: 0.25,
            burnCompletionRate: 0.5,
            shortCardCompletionRate: 0.85,
            actualVsEstimatedRatio: 1.2,
          }
        : {},
    dataQuality: {
      evidenceCount,
      reminderDeliveryReliable: true,
      hasEnoughData: evidenceCount >= 3,
    },
  };
}

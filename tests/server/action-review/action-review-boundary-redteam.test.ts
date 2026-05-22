import { describe, expect, it } from "vitest";

import { normalizeProofSignals } from "@/lib/server/action-review/signal-normalizer";
import { buildDefaultProfile } from "@/lib/server/action-review/profile-aggregator";
import { buildPolicySnapshot } from "@/lib/server/action-review/policy-engine";
import { buildProofSummaryInsight } from "@/lib/server/action-review/proof-summary-insight";
import { generateSoftTaskCandidates } from "@/lib/server/action-review/system-soft-task-candidates";
import type { ProofEventRef, ReminderAuditRef } from "@/lib/server/action-review/types";
import { expectForbiddenKeysAbsent, loadActionReviewFixture } from "./test-utils";

describe("action review boundary red-team", () => {
  it("policy snapshots cannot express committed state writes or protected time changes", () => {
    const profile = buildDefaultProfile("user-demo");
    const policy = buildPolicySnapshot(profile, { preset: "more-buffer" });

    expect(policy.forbiddenInfluence).toEqual(
      expect.arrayContaining(["hard-lock", "baseline-reminder-existence", "baseline-goal", "standard-goal"]),
    );
    expectForbiddenKeysAbsent(policy);
  });

  it("failed reminder delivery does not lower reminder response signals", async () => {
    const fixture = await loadActionReviewFixture<{ proofEvents: ProofEventRef[]; reminderAudit: ReminderAuditRef[] }>(
      "reminder-delivery-failed.json",
    );

    const aggregate = normalizeProofSignals(fixture.proofEvents, fixture.reminderAudit, {
      userId: "user-demo",
      windowDays: 14,
      now: "2026-05-21T12:00:00.000Z",
    });

    expect(aggregate.signals).not.toHaveProperty("deliveredReminderResponseRate");
    expect(aggregate.dataQuality.reminderDeliveryReliable).toBe(false);
  });

  it("soft task candidates stay as candidates and require Time Guardian review", () => {
    const profile = { ...buildDefaultProfile("user-demo"), mode: "candidate" as const, evidenceIds: ["evt_a"] };
    const policy = buildPolicySnapshot(profile, { preset: "short-card-focus" });
    const aggregate = {
      id: "aggregate_redteam",
      userId: "user-demo",
      windowDays: 14 as const,
      createdAt: "2026-05-21T12:00:00.000Z",
      evidenceEventIds: ["evt_a", "evt_b", "evt_c"],
      signals: { freezeRate: 0.5, burnCompletionRate: 0.5 },
      dataQuality: { evidenceCount: 3, reminderDeliveryReliable: true, hasEnoughData: true },
    };
    const insight = buildProofSummaryInsight(aggregate, profile, policy);

    const candidates = generateSoftTaskCandidates(profile, insight);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.defaultTension === "soft")).toBe(true);
    expect(candidates.every((candidate) => candidate.requiresTimeGuardianReview)).toBe(true);
    candidates.forEach(expectForbiddenKeysAbsent);
  });
});

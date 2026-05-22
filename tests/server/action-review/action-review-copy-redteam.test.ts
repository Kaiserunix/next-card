import { describe, it } from "vitest";

import { buildProfileExplanation } from "@/lib/server/action-review/explanation-builder";
import { buildDefaultProfile } from "@/lib/server/action-review/profile-aggregator";
import { buildPolicySnapshot } from "@/lib/server/action-review/policy-engine";
import { buildProofSummaryInsight } from "@/lib/server/action-review/proof-summary-insight";
import { generateSoftTaskCandidates } from "@/lib/server/action-review/system-soft-task-candidates";
import { expectSupportCopy } from "./test-utils";

describe("action review copy red-team", () => {
  it("keeps explanations and proof insights free of judgment labels", () => {
    const profile = { ...buildDefaultProfile("user-demo"), mode: "candidate" as const, evidenceIds: ["evt_1"] };
    const policy = buildPolicySnapshot(profile, { preset: "low-pressure-start" });
    const aggregate = {
      id: "aggregate_copy",
      userId: "user-demo",
      windowDays: 14 as const,
      createdAt: "2026-05-21T12:00:00.000Z",
      evidenceEventIds: ["evt_1", "evt_2", "evt_3"],
      signals: { freezeRate: 0.33, shortCardCompletionRate: 0.9, burnCompletionRate: 0.5 },
      dataQuality: { evidenceCount: 3, reminderDeliveryReliable: true, hasEnoughData: true },
    };

    const explanation = buildProfileExplanation(policy);
    const insight = buildProofSummaryInsight(aggregate, profile, policy);
    const candidates = generateSoftTaskCandidates(profile, insight);

    expectSupportCopy(explanation);
    expectSupportCopy(insight);
    expectSupportCopy(candidates);
  });
});

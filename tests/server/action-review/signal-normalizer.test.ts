import { describe, expect, it } from "vitest";

import { normalizeProofSignals } from "@/lib/server/action-review/signal-normalizer";
import type { ProofEventRef, ReminderAuditRef } from "@/lib/server/action-review/types";
import { loadActionReviewFixture } from "./test-utils";

describe("normalizeProofSignals", () => {
  it("returns an empty aggregate for empty proof without inferring behavior", async () => {
    const fixture = await loadActionReviewFixture<{ proofEvents: ProofEventRef[]; reminderAudit: ReminderAuditRef[] }>(
      "empty-proof-default-profile.json",
    );

    const aggregate = normalizeProofSignals(fixture.proofEvents, fixture.reminderAudit, {
      userId: "user-demo",
      windowDays: 14,
      now: "2026-05-21T12:00:00.000Z",
    });

    expect(aggregate.signals).toEqual({});
    expect(aggregate.dataQuality.evidenceCount).toBe(0);
    expect(aggregate.dataQuality.hasEnoughData).toBe(false);
  });

  it("calculates neutral completion, duration, and burn signals", async () => {
    const fixture = await loadActionReviewFixture<{ proofEvents: ProofEventRef[]; reminderAudit: ReminderAuditRef[] }>(
      "burn-then-completed-proof-events.json",
    );

    const aggregate = normalizeProofSignals(fixture.proofEvents, fixture.reminderAudit, {
      userId: "user-demo",
      windowDays: 14,
      now: "2026-05-21T12:00:00.000Z",
    });

    expect(aggregate.signals.firstCardStartDelayMinutes).toBe(8);
    expect(aggregate.signals.actualVsEstimatedRatio).toBeCloseTo(0.8, 2);
    expect(aggregate.signals.burnCompletionRate).toBe(1);
    expect(aggregate.signals.shortCardCompletionRate).toBe(1);
  });

  it("computes freeze recovery intervals without treating freeze as failure", async () => {
    const fixture = await loadActionReviewFixture<{ proofEvents: ProofEventRef[]; reminderAudit: ReminderAuditRef[] }>(
      "frozen-then-resumed-proof-events.json",
    );

    const aggregate = normalizeProofSignals(fixture.proofEvents, fixture.reminderAudit, {
      userId: "user-demo",
      windowDays: 14,
      now: "2026-05-21T12:00:00.000Z",
    });

    expect(aggregate.signals.freezeRate).toBe(0.5);
    expect(aggregate.signals.recoveryAfterFreezeMedianMinutes).toBe(90);
  });

  it("counts only delivered reminder responses and ignores failed delivery as user behavior", async () => {
    const delivered = await loadActionReviewFixture<{ proofEvents: ProofEventRef[]; reminderAudit: ReminderAuditRef[] }>(
      "reminder-delivered-and-responded.json",
    );
    const failed = await loadActionReviewFixture<{ proofEvents: ProofEventRef[]; reminderAudit: ReminderAuditRef[] }>(
      "reminder-delivery-failed.json",
    );

    const deliveredAggregate = normalizeProofSignals(delivered.proofEvents, delivered.reminderAudit, {
      userId: "user-demo",
      windowDays: 14,
      now: "2026-05-21T12:00:00.000Z",
    });
    const failedAggregate = normalizeProofSignals(failed.proofEvents, failed.reminderAudit, {
      userId: "user-demo",
      windowDays: 14,
      now: "2026-05-21T12:00:00.000Z",
    });

    expect(deliveredAggregate.signals.deliveredReminderResponseRate).toBe(1);
    expect(failedAggregate.signals).not.toHaveProperty("deliveredReminderResponseRate");
    expect(failedAggregate.dataQuality.reminderDeliveryReliable).toBe(false);
  });

  it("treats missing external notification permission as unreliable reminder response data", async () => {
    const fixture = await loadActionReviewFixture<{ proofEvents: ProofEventRef[]; reminderAudit: ReminderAuditRef[] }>(
      "notification-permission-missing.json",
    );

    const aggregate = normalizeProofSignals(fixture.proofEvents, fixture.reminderAudit, {
      userId: "user-demo",
      windowDays: 14,
      now: "2026-05-21T12:00:00.000Z",
    });

    expect(aggregate.signals).not.toHaveProperty("deliveredReminderResponseRate");
    expect(aggregate.dataQuality.reminderDeliveryReliable).toBe(false);
  });
});

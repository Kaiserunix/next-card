import { describe, expect, it } from "vitest";

import { validateQueueAction } from "@/lib/server/time-guardian/queue-action-validator";
import { scheduledEvent, snapshot, timeWindow } from "./test-utils";

describe("queue action validator", () => {
  it("allows model proposals only after deterministic validation", () => {
    const current = snapshot();
    const result = validateQueueAction(
      {
        type: "insert-schedule-event",
        id: "action_model_insert_prepare",
        snapshotId: current.id,
        actor: "model-proposal",
        reason: "Model proposed a prep window before verified class; validator checks it.",
        createdAt: current.now,
        event: scheduledEvent({ basedOnSnapshotId: current.id }),
      },
      { snapshot: current, expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.allowed).toBe(true);
  });

  it("rejects actions for unchosen plans", () => {
    const current = snapshot();
    const result = validateQueueAction(
      {
        type: "schedule-card",
        id: "action_wrong_plan",
        snapshotId: current.id,
        actor: "system-service",
        reason: "Should not schedule plan A cards after plan C was selected.",
        createdAt: current.now,
        cardId: "card_plan_a",
        deckId: "deck_calculus",
        chosenPlanId: "plan-a",
        window: timeWindow("window_a", "2026-05-21T07:10:00+08:00", "2026-05-21T07:20:00+08:00"),
      },
      { snapshot: current, expectedChosenPlanId: "plan-c", notificationCapability: "in_app_only" },
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain("chosen plan");
  });

  it("rejects card window insertions that collide with hard locks", () => {
    const current = snapshot();
    const result = validateQueueAction(
      {
        type: "insert-schedule-event",
        id: "action_conflict",
        snapshotId: current.id,
        actor: "system-service",
        reason: "This overlaps a verified class.",
        createdAt: current.now,
        event: scheduledEvent({
          id: "event_conflict",
          basedOnSnapshotId: current.id,
          startsAt: "2026-05-21T08:10:00+08:00",
          endsAt: "2026-05-21T08:20:00+08:00",
        }),
      },
      { snapshot: current, expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.conflictLockIds).toEqual(["lock_class_8am"]);
  });

  it("rejects card window insertions that collide with existing internal events", () => {
    const current = snapshot({
      scheduledEvents: [
        scheduledEvent({
          id: "event_existing_card",
          cardId: "card_existing",
          startsAt: "2026-05-21T07:20:00+08:00",
          endsAt: "2026-05-21T07:40:00+08:00",
        }),
      ],
    });
    const result = validateQueueAction(
      {
        type: "insert-schedule-event",
        id: "action_event_overlap",
        snapshotId: current.id,
        actor: "system-service",
        reason: "This overlaps an internal card window.",
        createdAt: current.now,
        event: scheduledEvent({
          id: "event_overlap",
          cardId: "card_overlap",
          basedOnSnapshotId: current.id,
          startsAt: "2026-05-21T07:30:00+08:00",
          endsAt: "2026-05-21T07:45:00+08:00",
        }),
      },
      { snapshot: current, expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("existing scheduled event");
      expect(result.requiresUserReview).toBe(true);
    }
  });

  it("rejects schedule-card actions that collide with active scheduled card windows", () => {
    const current = snapshot({
      activeCards: [
        {
          ...snapshot().activeCards[0],
          cardId: "card_active",
          scheduledWindow: timeWindow("window_active", "2026-05-21T07:15:00+08:00", "2026-05-21T07:35:00+08:00"),
          scheduleStatus: "scheduled",
        },
      ],
    });
    const result = validateQueueAction(
      {
        type: "schedule-card",
        id: "action_active_overlap",
        snapshotId: current.id,
        actor: "system-service",
        reason: "This overlaps an already scheduled active card.",
        createdAt: current.now,
        cardId: "card_overlap",
        deckId: "deck_calculus",
        chosenPlanId: "plan-b",
        window: timeWindow("window_overlap", "2026-05-21T07:25:00+08:00", "2026-05-21T07:45:00+08:00"),
      },
      { snapshot: current, expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("active scheduled card");
      expect(result.requiresUserReview).toBe(true);
    }
  });

  it("allows freeze-card actions for the selected committed card", () => {
    const current = snapshot();
    const result = validateQueueAction(
      {
        type: "freeze-card",
        id: "action_freeze_card_prepare",
        snapshotId: current.id,
        actor: "user",
        reason: "User froze this card and saved context for later.",
        createdAt: current.now,
        cardId: "card_prepare",
        deckId: "deck_calculus",
        chosenPlanId: "plan-b",
      },
      { snapshot: current, expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.allowed).toBe(true);
  });

  it("rejects freeze-card actions for cards outside the schedule snapshot", () => {
    const current = snapshot();
    const result = validateQueueAction(
      {
        type: "freeze-card",
        id: "action_freeze_missing_card",
        snapshotId: current.id,
        actor: "user",
        reason: "This card is not in the validated runtime snapshot.",
        createdAt: current.now,
        cardId: "card_missing",
        deckId: "deck_calculus",
        chosenPlanId: "plan-b",
      },
      { snapshot: current, expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain("card");
  });

  it("rejects external reminder jobs without notification permission", () => {
    const current = snapshot();
    const result = validateQueueAction(
      {
        type: "create-nudge-reminder",
        id: "action_external_nudge",
        snapshotId: current.id,
        actor: "system-service",
        reason: "Permission is missing, so this cannot be external.",
        createdAt: current.now,
        reminder: {
          id: "reminder_external",
          cardId: "card_prepare",
          deckId: "deck_calculus",
          chosenPlanId: "plan-b",
          fireAt: "2026-05-21T07:10:00+08:00",
          kind: "nudge",
          source: "agent-refined",
          capabilityRequired: "browser-notification",
          deliveryStatus: "planned",
          privacyLevel: "low-sensitive",
        },
      },
      { snapshot: current, expectedChosenPlanId: "plan-b", notificationCapability: "external_denied" },
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain("permission");
  });

  it("rejects nudge actions that remove the baseline reminder", () => {
    const current = snapshot({
      activeCards: [
        {
          ...snapshot().activeCards[0],
          baselineReminderId: "baseline_1",
        },
      ],
    });
    const result = validateQueueAction(
      {
        type: "create-nudge-reminder",
        id: "action_replace_baseline",
        snapshotId: current.id,
        actor: "model-proposal",
        reason: "Nudge cannot replace the guaranteed reminder.",
        createdAt: current.now,
        removesReminderIds: ["baseline_1"],
        reminder: {
          id: "nudge_1",
          cardId: "card_prepare",
          deckId: "deck_calculus",
          chosenPlanId: "plan-b",
          fireAt: "2026-05-21T07:05:00+08:00",
          kind: "nudge",
          source: "agent-refined",
          capabilityRequired: "none",
          deliveryStatus: "planned",
          privacyLevel: "low-sensitive",
        },
      },
      { snapshot: current, expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain("baseline");
  });

  it("rejects baseline reminders from agent-refined sources", () => {
    const current = snapshot();
    const result = validateQueueAction(
      {
        type: "create-baseline-reminder",
        id: "action_bad_baseline",
        snapshotId: current.id,
        actor: "model-proposal",
        reason: "Baseline reminders must not be model-owned.",
        createdAt: current.now,
        reminder: {
          id: "baseline_bad",
          cardId: "card_prepare",
          deckId: "deck_calculus",
          chosenPlanId: "plan-b",
          fireAt: "2026-05-21T07:30:00+08:00",
          kind: "baseline",
          source: "agent-refined",
          capabilityRequired: "none",
          deliveryStatus: "planned",
          privacyLevel: "low-sensitive",
        },
      },
      { snapshot: current, expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain("Baseline");
  });
});

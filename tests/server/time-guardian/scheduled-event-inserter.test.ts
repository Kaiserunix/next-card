import { describe, expect, it } from "vitest";

import { insertScheduledEvent } from "@/lib/server/time-guardian/scheduled-event-inserter";
import { scheduledEvent, snapshot } from "./test-utils";

describe("scheduled event inserter", () => {
  it("inserts verified internal card windows and baseline reminders", () => {
    const current = snapshot();
    const result = insertScheduledEvent(
      current,
      {
        type: "insert-schedule-event",
        id: "action_insert_prepare",
        snapshotId: current.id,
        actor: "system-service",
        reason: "Insert a preparation window before class.",
        createdAt: current.now,
        idempotencyKey: "deck_calculus:card_prepare:window",
        event: scheduledEvent({ basedOnSnapshotId: current.id }),
      },
      { expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.inserted).toBe(true);
    expect(result.snapshot.scheduledEvents).toHaveLength(1);
    expect(result.snapshot.scheduledEvents[0].kind).toBe("card-window");
  });

  it("does not create duplicate events for the same idempotency key", () => {
    const current = snapshot();
    const action = {
      type: "insert-schedule-event" as const,
      id: "action_insert_prepare",
      snapshotId: current.id,
      actor: "system-service" as const,
      reason: "Insert once.",
      createdAt: current.now,
      idempotencyKey: "deck_calculus:card_prepare:window",
      event: scheduledEvent({ basedOnSnapshotId: current.id }),
    };

    const first = insertScheduledEvent(current, action, {
      expectedChosenPlanId: "plan-b",
      notificationCapability: "in_app_only",
    });
    const second = insertScheduledEvent(first.snapshot, action, {
      expectedChosenPlanId: "plan-b",
      notificationCapability: "in_app_only",
    });

    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.snapshot.scheduledEvents).toHaveLength(1);
  });

  it("does not treat unrelated existing events as duplicates", () => {
    const current = snapshot({
      scheduledEvents: [
        scheduledEvent({
          id: "event_existing_nudge",
          kind: "nudge-reminder",
          cardId: "card_other",
          startsAt: undefined,
          endsAt: undefined,
          fireAt: "2026-05-21T07:10:00+08:00",
        }),
      ],
    });
    const result = insertScheduledEvent(
      current,
      {
        type: "insert-schedule-event",
        id: "action_insert_prepare",
        snapshotId: current.id,
        actor: "system-service",
        reason: "Insert a different preparation window.",
        createdAt: current.now,
        idempotencyKey: "deck_calculus:card_prepare:window",
        event: scheduledEvent({ basedOnSnapshotId: current.id }),
      },
      { expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.inserted).toBe(true);
    expect(result.snapshot.scheduledEvents).toHaveLength(2);
  });

  it("rejects inserted card windows that overlap existing internal events", () => {
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

    const result = insertScheduledEvent(
      current,
      {
        type: "insert-schedule-event",
        id: "action_insert_overlap",
        snapshotId: current.id,
        actor: "system-service",
        reason: "Try inserting an overlapping preparation card.",
        createdAt: current.now,
        idempotencyKey: "deck_calculus:card_overlap:window",
        event: scheduledEvent({
          id: "event_overlap",
          cardId: "card_overlap",
          startsAt: "2026-05-21T07:30:00+08:00",
          endsAt: "2026-05-21T07:45:00+08:00",
          basedOnSnapshotId: current.id,
        }),
      },
      { expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.inserted).toBe(false);
    expect(result.reason).toContain("overlaps existing scheduled event");
    expect(result.snapshot.scheduledEvents).toHaveLength(1);
  });

  it("rejects inserted card windows that overlap active scheduled card windows", () => {
    const current = snapshot({
      activeCards: [
        {
          cardId: "card_active",
          deckId: "deck_calculus",
          chosenPlanId: "plan-b",
          tension: "hard",
          estimatedMinutes: 20,
          scheduledWindow: {
            id: "window_active",
            startAt: "2026-05-21T07:15:00+08:00",
            endAt: "2026-05-21T07:35:00+08:00",
            timezone: "Asia/Shanghai",
            source: "derived",
            confidence: 0.95,
          },
          hardLockRefs: [],
          nudgeReminderIds: [],
          scheduleStatus: "scheduled",
        },
      ],
    });

    const result = insertScheduledEvent(
      current,
      {
        type: "insert-schedule-event",
        id: "action_insert_active_overlap",
        snapshotId: current.id,
        actor: "system-service",
        reason: "Try inserting over an active scheduled card.",
        createdAt: current.now,
        idempotencyKey: "deck_calculus:card_active_overlap:window",
        event: scheduledEvent({
          id: "event_active_overlap",
          cardId: "card_active_overlap",
          startsAt: "2026-05-21T07:25:00+08:00",
          endsAt: "2026-05-21T07:45:00+08:00",
          basedOnSnapshotId: current.id,
        }),
      },
      { expectedChosenPlanId: "plan-b", notificationCapability: "in_app_only" },
    );

    expect(result.inserted).toBe(false);
    expect(result.reason).toContain("overlaps active scheduled card");
    expect(result.snapshot.activeCards).toHaveLength(1);
    expect(result.snapshot.scheduledEvents).toHaveLength(0);
  });
});

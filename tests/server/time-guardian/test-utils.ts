import type {
  CommittedCardRef,
  CommittedDeckRef,
  EvidenceRef,
  FrozenQueueItem,
  ScheduleSnapshot,
  ScheduledCardRef,
  ScheduledEvent,
  TimeLock,
  TimeWindow,
} from "@/lib/server/time-guardian/types";

export const NOW = "2026-05-21T07:00:00+08:00";
export const TZ = "Asia/Shanghai";

export function evidence(id = "evidence_1"): EvidenceRef {
  return {
    rawInputId: id,
    quote: "Verified by user",
    confidence: 0.95,
  };
}

export function timeWindow(id: string, startAt: string, endAt: string): TimeWindow {
  return {
    id,
    startAt,
    endAt,
    timezone: TZ,
    source: "derived",
    confidence: 0.95,
  };
}

export function classLock(overrides: Partial<TimeLock> = {}): TimeLock {
  return {
    id: "lock_class_8am",
    userId: "anon",
    kind: "class_time",
    startAt: "2026-05-21T08:00:00+08:00",
    endAt: "2026-05-21T09:30:00+08:00",
    timezone: TZ,
    movable: false,
    sourceRefs: [evidence("raw_class")],
    reviewStatus: "verified",
    conflictStatus: "none",
    ...overrides,
  };
}

export function submissionDeadline(overrides: Partial<TimeLock> = {}): TimeLock {
  return {
    id: "lock_assignment_due",
    userId: "anon",
    kind: "submission_deadline",
    dueAt: "2026-05-21T20:00:00+08:00",
    timezone: TZ,
    movable: false,
    sourceRefs: [evidence("raw_assignment")],
    reviewStatus: "user-confirmed",
    conflictStatus: "none",
    ...overrides,
  };
}

export function lockedBlock(overrides: Partial<TimeLock> = {}): TimeLock {
  return {
    id: "lock_lunch",
    userId: "anon",
    kind: "user_locked_block",
    startAt: "2026-05-21T12:00:00+08:00",
    endAt: "2026-05-21T13:00:00+08:00",
    timezone: TZ,
    movable: false,
    sourceRefs: [evidence("raw_locked")],
    reviewStatus: "user-confirmed",
    conflictStatus: "none",
    ...overrides,
  };
}

export function scheduledCard(overrides: Partial<ScheduledCardRef> = {}): ScheduledCardRef {
  return {
    cardId: "card_prepare",
    deckId: "deck_calculus",
    chosenPlanId: "plan-b",
    tension: "hard",
    estimatedMinutes: 15,
    hardLockRefs: ["lock_class_8am"],
    nudgeReminderIds: [],
    scheduleStatus: "unscheduled",
    ...overrides,
  };
}

export function committedCard(overrides: Partial<CommittedCardRef> = {}): CommittedCardRef {
  return {
    cardId: "card_prepare",
    deckId: "deck_calculus",
    chosenPlanId: "plan-b",
    title: "Pack calculus materials",
    tension: "hard",
    estimatedMinutes: 15,
    hardLockRefs: ["lock_class_8am"],
    preferredStartAt: "2026-05-21T07:25:00+08:00",
    ...overrides,
  };
}

export function committedDeck(overrides: Partial<CommittedDeckRef> = {}): CommittedDeckRef {
  return {
    deckId: "deck_calculus",
    chosenPlanId: "plan-b",
    title: "Go to calculus class",
    ...overrides,
  };
}

export function frozenItem(overrides: Partial<FrozenQueueItem> = {}): FrozenQueueItem {
  return {
    id: "frozen_prepare",
    cardId: "card_prepare",
    deckId: "deck_calculus",
    chosenPlanId: "plan-b",
    frozenAt: "2026-05-21T07:45:00+08:00",
    reason: "User saved context for later.",
    estimatedMinutes: 10,
    tension: "recommended",
    ...overrides,
  };
}

export function scheduledEvent(overrides: Partial<ScheduledEvent> = {}): ScheduledEvent {
  return {
    id: "event_card_prepare",
    userId: "anon",
    kind: "card-window",
    deckId: "deck_calculus",
    cardId: "card_prepare",
    chosenPlanId: "plan-b",
    startsAt: "2026-05-21T07:25:00+08:00",
    endsAt: "2026-05-21T07:40:00+08:00",
    timezone: TZ,
    source: "time-guardian",
    status: "planned",
    basedOnSnapshotId: "snapshot_test",
    sourceRefs: ["raw_class"],
    reason: "Prepare before verified 08:00 class.",
    ...overrides,
  };
}

export function snapshot(overrides: Partial<ScheduleSnapshot> = {}): ScheduleSnapshot {
  return {
    id: "snapshot_test",
    version: 1,
    now: NOW,
    timezone: TZ,
    committedDecks: [committedDeck()],
    activeCards: [scheduledCard()],
    scheduledEvents: [],
    timeLocks: [classLock()],
    availableWindows: [timeWindow("window_morning", "2026-05-21T07:00:00+08:00", "2026-05-21T08:00:00+08:00")],
    frozenQueue: [],
    policySnapshotId: "policy_default",
    ...overrides,
  };
}

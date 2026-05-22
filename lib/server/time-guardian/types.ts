export type TimeLockKind =
  | "class_time"
  | "exam_time"
  | "submission_deadline"
  | "fixed_calendar_event"
  | "user_locked_block";

export type TaskTension =
  | "hard"
  | "deadline-sensitive"
  | "recommended"
  | "soft"
  | "background"
  | "unknown";

export type ScheduledEventKind =
  | "card-window"
  | "baseline-reminder"
  | "nudge-reminder"
  | "deadline-warning"
  | "soft-task-surface"
  | "soft-task-harden"
  | "freeze-return"
  | "review-request"
  | "in-app-reminder";

export type NotificationCapability =
  | "unknown"
  | "external_granted"
  | "external_denied"
  | "external_revoked"
  | "in_app_only";

export type EvidenceRef = {
  rawInputId: string;
  page?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  textSpan?: {
    start: number;
    end: number;
  };
  quote?: string;
  confidence: number;
};

export type TimeLock = {
  id: string;
  userId: string;
  kind: TimeLockKind;
  startAt?: string;
  endAt?: string;
  dueAt?: string;
  timezone: string;
  movable: false;
  sourceRefs: EvidenceRef[];
  reviewStatus: "verified" | "user-confirmed";
  conflictStatus: "none" | "conflict_detected" | "resolved";
};

export type TimeWindow = {
  id: string;
  startAt: string;
  endAt: string;
  timezone: string;
  source: "derived" | "user-stated" | "calendar-gap" | "default";
  confidence: number;
};

export type ScheduledEventSource = "time-guardian" | "system-fallback" | "agent-refined" | "user-fixed";

export type ScheduledEvent = {
  id: string;
  userId: string;
  kind: ScheduledEventKind;
  deckId?: string;
  cardId?: string;
  chosenPlanId?: string;
  startsAt?: string;
  endsAt?: string;
  fireAt?: string;
  timezone: string;
  source: ScheduledEventSource;
  status: "planned" | "inserted" | "blocked" | "cancelled" | "delivered" | "failed";
  basedOnSnapshotId: string;
  sourceRefs: string[];
  reason: string;
};

export type ScheduledCardRef = {
  cardId: string;
  deckId: string;
  chosenPlanId: string;
  tension: TaskTension;
  estimatedMinutes: number;
  scheduledWindow?: TimeWindow;
  deadlineAt?: string;
  hardLockRefs: string[];
  baselineReminderId?: string;
  nudgeReminderIds: string[];
  scheduleStatus:
    | "unscheduled"
    | "scheduled"
    | "active"
    | "deferred"
    | "frozen"
    | "blocked_by_conflict"
    | "needs_review";
};

export type ScheduledCard = ScheduledCardRef;

export type ScheduledDeckRef = {
  deckId: string;
  chosenPlanId: string;
  title: string;
};

export type FrozenQueueItem = {
  id: string;
  cardId: string;
  deckId: string;
  chosenPlanId: string;
  frozenAt: string;
  reason: string;
  contextNote?: string;
  deadlineAt?: string;
  estimatedMinutes?: number;
  tension?: TaskTension;
};

export type ScheduleSnapshot = {
  id: string;
  version: number;
  now: string;
  timezone: string;
  committedDecks: ScheduledDeckRef[];
  activeCards: ScheduledCardRef[];
  scheduledEvents: ScheduledEvent[];
  timeLocks: TimeLock[];
  availableWindows: TimeWindow[];
  frozenQueue: FrozenQueueItem[];
  policySnapshotId?: string;
};

export type ReminderPlan = {
  id: string;
  cardId: string;
  deckId: string;
  chosenPlanId: string;
  fireAt: string;
  kind: "baseline" | "nudge" | "deadline-warning" | "in-app-only";
  source: "system-fallback" | "agent-refined" | "user-fixed";
  capabilityRequired: "none" | "browser-notification" | "web-push" | "native";
  deliveryStatus: "planned" | "scheduled" | "delivered" | "failed" | "cancelled";
  privacyLevel: "low-sensitive" | "detailed";
  reason?: string;
  userVisibleCopy?: string;
};

export type SoftTaskTiming = {
  recommendedGoodLineAt: string | null;
  mustNudgeAfterAt: string | null;
  deadlineAt: string | null;
  hardensAt: string | null;
  reason: string;
};

export type DeadlineWarningLevel = "none" | "watch" | "risk" | "critical";

export type RecoveryOption = {
  id: string;
  kind: "shrink-progress-goal" | "reschedule" | "ask-user" | "keep-frozen";
  label: string;
  reason: string;
};

export type DeadlineWarning = {
  level: DeadlineWarningLevel;
  reason: string;
  affectedCardIds: string[];
  suggestedRecoveryOptions: RecoveryOption[];
};

export type QueueActionActor = "system-service" | "model-proposal" | "user";

export type QueueActionBase = {
  id: string;
  snapshotId: string;
  actor: QueueActionActor;
  reason: string;
  createdAt: string;
  policySnapshotId?: string;
  chosenPlanId?: string;
  idempotencyKey?: string;
};

export type InsertScheduleEventAction = QueueActionBase & {
  type: "insert-schedule-event";
  event: ScheduledEvent;
};

export type ScheduleCardAction = QueueActionBase & {
  type: "schedule-card";
  cardId: string;
  deckId: string;
  chosenPlanId: string;
  window: TimeWindow;
};

export type DeferCardAction = QueueActionBase & {
  type: "defer-card";
  cardId: string;
  deckId: string;
  chosenPlanId: string;
  fromWindow?: TimeWindow;
  toWindow: TimeWindow;
  deadlineAt?: string;
};

export type FreezeCardAction = QueueActionBase & {
  type: "freeze-card";
  cardId: string;
  deckId: string;
  chosenPlanId: string;
};

export type ReinsertFrozenCardAction = QueueActionBase & {
  type: "reinsert-frozen-card";
  frozenItemId: string;
  cardId: string;
  deckId: string;
  chosenPlanId: string;
  window?: TimeWindow;
};

export type CreateBaselineReminderAction = QueueActionBase & {
  type: "create-baseline-reminder";
  reminder: ReminderPlan;
};

export type CreateNudgeReminderAction = QueueActionBase & {
  type: "create-nudge-reminder";
  reminder: ReminderPlan;
  removesReminderIds?: string[];
};

export type UpdateSoftTaskTensionAction = QueueActionBase & {
  type: "update-soft-task-tension";
  cardId: string;
  deckId: string;
  from: TaskTension;
  to: TaskTension;
  timing?: SoftTaskTiming;
  userVisibleCopy?: string;
};

export type EmitDeadlineWarningAction = QueueActionBase & {
  type: "emit-deadline-warning";
  warning: DeadlineWarning;
};

export type RequestUserReviewAction = QueueActionBase & {
  type: "request-user-review";
  reviewReason: string;
  affectedCardIds: string[];
  recoveryOptions: RecoveryOption[];
};

export type QueueAction =
  | InsertScheduleEventAction
  | ScheduleCardAction
  | DeferCardAction
  | FreezeCardAction
  | ReinsertFrozenCardAction
  | CreateBaselineReminderAction
  | CreateNudgeReminderAction
  | UpdateSoftTaskTensionAction
  | EmitDeadlineWarningAction
  | RequestUserReviewAction;

export type TimeProofEventRequest = {
  id: string;
  eventType: "reminder-created" | "deadline-warning" | "frozen-return" | "schedule-inserted";
  reason: string;
  sourceActionIds: string[];
};

export type TimeGuardianDecision = {
  id: string;
  snapshotId: string;
  actionIds: string[];
  decisionType:
    | "schedule"
    | "defer-safe"
    | "defer-rejected"
    | "soft-task-surface"
    | "soft-task-harden"
    | "deadline-warning"
    | "freeze-return"
    | "needs-review";
  reason: string;
  userVisibleCopy?: string;
  proofEventRequest?: TimeProofEventRequest;
};

export type CommittedDeckRef = {
  deckId: string;
  chosenPlanId: string;
  title: string;
};

export type CommittedCardRef = {
  cardId: string;
  deckId: string;
  chosenPlanId: string;
  title: string;
  tension: TaskTension;
  estimatedMinutes: number;
  deadlineAt?: string;
  hardLockRefs: string[];
  preferredStartAt?: string;
};

export type AgentPolicySnapshot = {
  id: string;
  cardGranularity?: "micro" | "standard" | "dense";
  reminderStrictness?: "light" | "normal" | "strong";
  safetyBufferMinutes?: number;
};

export type GoalContract = {
  id: string;
  deckId: string;
  baselineGoal: {
    description: string;
    autoReducible: false;
  };
  standardGoal: {
    description: string;
    autoReducible: false;
  };
  progressGoal: {
    description: string;
    canShrinkForActivation: true;
    expiresAt?: string;
  };
  qualityDebt: Array<{
    id: string;
    deckId: string;
    cardId?: string;
    reason: "compressed_plan" | "user_deferred" | "frozen" | "deadline_recovery";
    description: string;
    stillRelevant: boolean;
    userDismissed: boolean;
  }>;
};

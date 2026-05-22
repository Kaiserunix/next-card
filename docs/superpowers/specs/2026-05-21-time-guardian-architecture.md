# Next Card Time Guardian Architecture

Date: 2026-05-21
Status: second-layer architecture draft

## Core Position

The second layer is:

```text
时间守护层 / Time Guardian Layer
```

It is not a single autonomous scheduling agent.

It is a controlled runtime domain made of deterministic services, validators, proposal workers, reminder adapters, and queue actions.

User-facing language should never expose "Agent2". The user only sees:

- card time UI,
- schedule suggestions,
- reminder status,
- deadline warnings,
- freeze/reschedule recovery,
- soft task suggestions,
- proof entries after validated events.

## Main Responsibility

Time Guardian protects time reality.

It decides when a card should be surfaced, whether a delay is safe, whether a soft task should remain optional, when a deadline warning should appear, and how reminders should be created without violating hard locks.

Its north star:

```text
Help the user act at the right time without letting AI silently rewrite time.
```

## Non-Negotiable Invariants

1. Hard locks are never silently moved.
2. Verified class time, exam time, submission deadline, fixed calendar event, and user-locked blocks are protected.
3. Every verified time-protected card must have a guaranteed user-default reminder.
4. The guaranteed user-default reminder cannot be deleted by agent output.
5. Missing external notification permission must downgrade to in-app reminder state.
6. A reminder that failed to deliver cannot be interpreted as user ignoring it.
7. Soft tasks may be deferred before the recommended good line without failure language.
8. Soft tasks may harden only through deterministic policy rules and explainable schedule evidence.
9. Profile policy may adjust granularity, buffer, nudge tone, and recovery strategy, but must not move hard locks or reduce baseline/standard goals.
10. Time Guardian may propose schedule actions, but authority writes must go through validated `QueueAction` and state services.
11. Automatic event insertion is a core Time Guardian capability. The layer must be able to analyze confirmed tasks and insert internal schedule events, card windows, reminder events, soft-task surface events, and freeze-return events after validation.
12. Automatic event insertion must not create new hard facts from unverified input. It can insert schedule events around verified facts; it cannot silently invent a class time, exam time, or submission deadline.

## Upstream And Downstream Boundaries

### Inputs From Layer 1

Layer 1 provides confirmed or reviewed facts:

```text
VerifiedInputBundle
ConfirmedTaskFact
ConfirmedTimeFact
ConfirmedLocationFact
PlanCompilerHandoff
```

Layer 2 must not trust raw extraction output as final time truth.

Time Guardian can read:

- verified task facts,
- verified time facts,
- confirmed task lifecycle,
- confirmed tension level when available,
- source evidence refs,
- location/timezone hints.

Time Guardian must not read unconfirmed OCR/PDF/notification facts as hard locks.

### Inputs From Deck Commit

After the user chooses A/B/C, Deck Commit Service provides:

```text
CommittedDeck
CommittedCard[]
ChosenPlanId
GoalContract
PolicySnapshotId
```

Time Guardian schedules the chosen plan only.

It must not schedule unchosen A/B/C options.

### Inputs From Layer 3

Layer 3 provides policy, not authority:

```text
AgentPolicySnapshot
ProfileSnapshot
```

Allowed influence:

- card granularity,
- buffer size,
- nudge tone,
- nudge frequency cap,
- burn sensitivity,
- freeze recovery style.

Forbidden influence:

- changing deadline,
- moving hard lock,
- deleting guaranteed reminder,
- reducing baseline or standard goal,
- rewriting proof.

### Outputs

Time Guardian outputs:

- schedule proposal,
- internal schedule event insertion,
- validated queue actions,
- reminder plan,
- nudge proposal,
- deadline warning,
- freeze return proposal,
- conflict report,
- audit event request.

It does not directly output:

- committed deck,
- proof record,
- profile update,
- raw notification delivery fact.

## Automatic Event Insertion

Automatic analysis and event insertion are core product functions.

Time Guardian should be able to insert events into the app's internal schedule and deck library after validation.

This means:

```text
verified task / committed card
-> analyze time pressure, hard locks, soft-task timing, free windows
-> create validated schedule events
-> surface the right card or reminder at the right time
```

Allowed inserted events:

- planned card execution window,
- baseline reminder event,
- additional nudge event,
- deadline warning event,
- soft-task suggestion event,
- soft-task hardening event,
- frozen-card return event,
- user-review request event,
- in-app-only reminder event when external permission is missing.

Forbidden inserted events:

- unverified class time,
- unverified exam time,
- unverified submission deadline,
- external notification event without permission,
- external calendar event without calendar permission or export confirmation,
- proof completion event,
- profile update event,
- hidden rewrite of a user-locked block.

The important distinction:

```text
insert schedule event around verified facts = allowed and required
invent or rewrite authoritative time facts = forbidden
```

For example:

```text
Verified fact: 高数课明天 08:00
Inserted events:
  07:30 baseline reminder for the 08:00 class hard lock
  07:10 optional nudge if travel/preparation buffer is needed
  07:25 出门准备卡
  07:45 到教室卡
  08:00 class_time hard lock reference
```

The inserted preparation/reminder events are automatic. The 08:00 class hard lock itself must come from verified/user-confirmed time facts.

## Internal Service Split

Recommended split:

```text
Time Constraint Reader
-> Schedule Snapshot Builder
-> Hard Lock Validator
-> Tension Classifier
-> Scheduling Kernel
-> Reminder Baseline Service
-> Nudge Proposal Worker
-> Deadline Warning Engine
-> Freeze Return Service
-> QueueAction Validator
-> Reminder Service / Notification Adapter
-> Time Guardian Audit
```

### Time Constraint Reader

Reads verified time constraints from authority stores.

Can read:

- class time,
- exam time,
- submission deadline,
- fixed calendar event,
- user-locked block,
- available window,
- soft task good line,
- existing reminder preference.

Cannot create new hard locks from model output.

### Schedule Snapshot Builder

Builds a deterministic snapshot:

```ts
type ScheduleSnapshot = {
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
```

The snapshot is read-only and versioned. All queue actions must state which snapshot they were based on.

### Hard Lock Validator

Owns hard lock protection.

Rejects actions that:

- move a hard lock,
- schedule a card over a hard lock without explicit user confirmation,
- defer a task past a submission deadline,
- treat a recurring class as one-off,
- overwrite user-locked blocks.

### Tension Classifier

Assigns or updates scheduling tension:

```ts
type TaskTension =
  | "hard"
  | "deadline-sensitive"
  | "recommended"
  | "soft"
  | "background"
  | "unknown";
```

Current interpretation:

- `hard`: class, exam, submission deadline, fixed calendar event, user-locked block.
- `deadline-sensitive`: deadline exists and slack is narrowing.
- `recommended`: useful soon, but not mandatory yet.
- `soft`: optional before good line.
- `background`: low relevance, only surface when context is favorable.
- `unknown`: needs review or more data.

This classifier must be explainable. It should output reasons, not personality judgments.

### Scheduling Kernel

Deterministically places cards into available windows.

Inputs:

- committed cards,
- estimated duration,
- hard locks,
- available windows,
- task tension,
- chosen plan mode,
- policy snapshot.

Outputs:

- schedule proposal,
- inserted internal schedule events,
- safe/unsafe defer decision,
- conflict report,
- `QueueAction[]`.

It must not invoke LLMs for final time arithmetic.

### Reminder Baseline Service

Creates the guaranteed reminder.

Default:

```text
30 minutes before task start
```

User options:

```text
15 / 30 / 45 / custom
```

If less time remains:

```text
fireAt = now / immediately
```

The baseline reminder source is:

```text
system-fallback
```

It cannot be deleted by agent-refined reminders.

### Nudge Proposal Worker

May use model/policy judgment to suggest additional nudges.

It can propose:

- earlier start nudge,
- soft task suggestion when time is free,
- deadline risk nudge,
- recovery nudge after freeze/burn.

It cannot:

- create external notification directly,
- exceed frequency caps,
- remove baseline reminder,
- shame the user,
- turn failed delivery into user behavior.

Nudges become real only after QueueAction validation and reminder permission checks.

### Deadline Warning Engine

Computes warning levels:

```ts
type DeadlineWarningLevel = "none" | "watch" | "risk" | "critical";
```

Inputs:

- dueAt,
- now,
- remaining estimated work,
- fixed busy time,
- safety buffer,
- completion state,
- confidence of time estimates.

Output:

```ts
type DeadlineWarning = {
  level: DeadlineWarningLevel;
  reason: string;
  affectedCardIds: string[];
  suggestedRecoveryOptions: RecoveryOption[];
};
```

Warnings do not automatically downgrade goals.

### Freeze Return Service

Handles frozen cards/decks.

Freezing means:

```text
context saved
-> card/deck enters frozen queue
-> Time Guardian reviews later
-> safe reinsert / ask user / keep frozen
```

It can propose:

- reinsert today,
- reinsert tomorrow,
- turn into smaller first card,
- keep frozen until good line,
- ask user for review if deadline risk changed.

It cannot delete the task or mark it failed.

### QueueAction Validator

All schedule mutations are represented as typed queue actions.

```ts
type QueueAction =
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
```

Every action must include:

```ts
type QueueActionBase = {
  id: string;
  snapshotId: string;
  actor: "system-service" | "model-proposal" | "user";
  reason: string;
  createdAt: string;
  policySnapshotId?: string;
};
```

Validator checks:

- schema validity,
- hard lock conflicts,
- permission state,
- idempotency key,
- baseline reminder preservation,
- user confirmation requirements,
- chosenPlanId consistency.

## Core Data Structures

### ScheduledEvent

```ts
type ScheduledEvent = {
  id: string;
  userId: string;
  kind:
    | "card-window"
    | "baseline-reminder"
    | "nudge-reminder"
    | "deadline-warning"
    | "soft-task-surface"
    | "soft-task-harden"
    | "freeze-return"
    | "review-request"
    | "in-app-reminder";
  deckId?: string;
  cardId?: string;
  chosenPlanId?: string;
  startsAt?: string;
  endsAt?: string;
  fireAt?: string;
  timezone: string;
  source:
    | "time-guardian"
    | "system-fallback"
    | "agent-refined"
    | "user-fixed";
  status: "planned" | "inserted" | "blocked" | "cancelled" | "delivered" | "failed";
  basedOnSnapshotId: string;
  sourceRefs: string[];
  reason: string;
};
```

Inserted events are internal Next Card schedule objects. They are not the same as external phone/calendar events unless a later notification/calendar adapter explicitly exports or schedules them.

### TimeLock

```ts
type TimeLock = {
  id: string;
  userId: string;
  kind:
    | "class_time"
    | "exam_time"
    | "submission_deadline"
    | "fixed_calendar_event"
    | "user_locked_block";
  startAt?: string;
  endAt?: string;
  dueAt?: string;
  timezone: string;
  movable: false;
  sourceRefs: EvidenceRef[];
  reviewStatus: "verified" | "user-confirmed";
  conflictStatus: "none" | "conflict_detected" | "resolved";
};
```

### TimeWindow

```ts
type TimeWindow = {
  id: string;
  startAt: string;
  endAt: string;
  timezone: string;
  source: "derived" | "user-stated" | "calendar-gap" | "default";
  confidence: number;
};
```

### ScheduledCard

```ts
type ScheduledCard = {
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
```

### ReminderPlan

```ts
type ReminderPlan = {
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
};
```

### NotificationCapability

```ts
type NotificationCapability =
  | "unknown"
  | "external_granted"
  | "external_denied"
  | "external_revoked"
  | "in_app_only";
```

If capability is not `external_granted`, external reminder jobs are not created. The system may keep in-app reminder state and tell the user it is in-app only.

### SoftTaskTiming

```ts
type SoftTaskTiming = {
  recommendedGoodLineAt: string | null;
  mustNudgeAfterAt: string | null;
  deadlineAt: string | null;
  hardensAt: string | null;
  reason: string;
};
```

Soft task hardening is a scheduling fact, not a moral label.

### TimeGuardianDecision

```ts
type TimeGuardianDecision = {
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
```

Proof events are requests to Proof Ledger. Time Guardian does not directly append proof.

## Main Flows

### New Committed Deck Scheduling

```text
Deck Commit Service emits committed deck
-> Schedule Snapshot Builder
-> Hard Lock Validator
-> Tension Classifier
-> Scheduling Kernel
-> InsertScheduleEventAction for card windows
-> Reminder Baseline Service
-> QueueAction Validator
-> Reminder Service / in-app reminder state
-> card time UI receives schedule state
```

### User Defers A Card

```text
User requests defer
-> Scheduling Kernel proposes new window
-> Hard Lock Validator checks collisions
-> safe: DeferCardAction
-> unsafe: RequestUserReviewAction + recovery options
```

Unsafe defer must not silently move the hard lock.

### User Freezes A Card

```text
User freezes card
-> Card Runtime marks frozen through valid card action
-> frozen item enters frozen queue
-> Time Guardian reviews frozen queue later
-> safe reinsert / ask review / keep frozen
```

### Soft Task Surfacing

```text
Deck Library contains soft task
-> Schedule Snapshot Builder finds available window
-> Tension Classifier checks good line
-> before good line: optional suggestion
-> after good line: stronger nudge / deadline-sensitive
-> InsertScheduleEventAction creates internal soft-task surface event
-> QueueAction Validator checks caps and hard locks
```

Soft task surfacing should feel like a light card suggestion, not a todo-list takeover.

### Deadline Warning

```text
Deadline Warning Engine calculates slack
-> watch / risk / critical
-> emit warning action
-> optionally propose A/B/C recovery options
-> never auto-lower baselineGoal or standardGoal
```

### Reminder Permission Downgrade

```text
Reminder plan created
-> NotificationCapability checked
-> external_granted: schedule external job
-> denied/revoked/unknown: create in-app-only reminder state
-> UI copy says only in-app reminder is active
```

### Automatic Insertion Example

Input:

```text
用户确认：明天 8:00 去高数课
用户选择：方案 B
```

Time Guardian may automatically insert:

```text
07:30 baseline reminder for the 08:00 class hard lock
07:10 optional nudge if travel/preparation buffer is needed
07:25 card-window: 整理课本和作业页
07:40 card-window: 出门去教室
07:55 deadline-warning/watch if location implies travel risk
08:00 hard lock reference: 高数课开始
```

It may not:

```text
invent 高数课地点
change 08:00 to 08:30
schedule option A cards if the user chose option B
claim an external notification exists without permission
```

## User-Facing Copy Rules

Good copy:

```text
这张卡会影响后面的截止时间，现在开始会保留更多缓冲。
这张卡已经接近最佳行动窗口。
当前只能在应用内提醒，外部通知还没有开启。
这张卡可以先放回牌库，稍后重新安排。
```

Forbidden copy:

```text
你又拖了。
你太懒了。
你失败了。
系统已经帮你改了截止时间。
已设置外部提醒。  // when permission is missing
```

## MVP Scope

MVP should include:

- deterministic schedule snapshot,
- automatic internal event insertion,
- hard lock validation,
- guaranteed baseline reminder plan,
- in-app reminder fallback,
- simple deadline warning,
- soft task timing fields,
- freeze return queue proposal,
- queue action validation,
- tests for hard lock and baseline reminder invariants.

MVP should not include:

- background web push,
- native mobile alarm bridge,
- calendar account sync,
- automatic cross-deck optimization,
- automatic profile-driven schedule rewriting,
- AI-only final scheduling,
- hidden movement of hard locks.

## Acceptance Tests

1. A card with verified deadline always gets a baseline reminder.
2. An agent-refined nudge cannot delete the baseline reminder.
3. Missing notification permission creates in-app-only state and does not claim external reminder.
4. Deferring a card over class time is rejected or requires user review.
5. User-fixed blocks cannot be moved by scheduling.
6. A C plan deck is scheduled only using the chosen C plan cards.
7. A soft task before good line stays optional.
8. A soft task after hardensAt becomes deadline-sensitive through an explainable action.
9. A frozen card re-enters review without being deleted.
10. A failed reminder delivery is not counted as user ignoring.
11. Deadline warning does not reduce baselineGoal or standardGoal.
12. Prompt/profile/model output cannot directly create reminder jobs.
13. A verified class task can automatically insert preparation card windows and reminder events.
14. Automatic insertion cannot create a hard lock from unverified OCR/PDF/notification text.

## Suggested Execution Packages

If this architecture is accepted, split implementation planning into:

1. Time Guardian contracts and fixture tests.
2. Schedule snapshot and hard lock validator.
3. QueueAction validator and idempotency.
4. Baseline reminder and notification capability fallback.
5. Deadline warning engine.
6. Soft task good line and tension classifier.
7. Freeze return queue.
8. Red-team tests and skill draft for Time Guardian.

## Open Questions

1. Should `recommendedGoodLineAt` and `hardensAt` be visible as explicit times, or only translated into gentle reminders?
2. How many extra nudges per deck per day is acceptable before it feels noisy?
3. Should MVP reminders be in-app only, browser notification optional, or browser notification required?
4. When a soft task hardens, should it move into active deck mode or remain in proof/deck overview until tapped?
5. Should Time Guardian produce A/B/C recovery options itself, or call Plan Compiler with a recovery mode?
6. How much of schedule reasoning should be visible in proof summary?

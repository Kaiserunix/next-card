# Next Card Time Guardian Contract

Date: 2026-05-21
Status: implementation contract

## Purpose

This contract defines the second layer scheduling boundary for Next Card. Time Guardian may automatically insert internal schedule events around verified facts, but every mutation is represented as a validated `QueueAction` over a versioned `ScheduleSnapshot`.

## Authority Boundary

- Time Guardian can create schedule proposals, internal `ScheduledEvent` records, reminder plans, deadline warnings, soft-task tension updates, and frozen-card return proposals.
- Time Guardian cannot directly write proof, profile, committed decks, external notification jobs, external calendars, or new hard facts from unverified OCR/PDF/notification text.
- Model or hidden-worker output is only a proposal until deterministic services validate it.

## Core Types

Implemented in `lib/server/time-guardian/types.ts`:

- `TimeLock`
- `TimeWindow`
- `ScheduledEvent`
- `ScheduledCard`
- `ScheduleSnapshot`
- `ReminderPlan`
- `SoftTaskTiming`
- `QueueAction`
- `QueueActionBase`
- `TimeGuardianDecision`

## Required Invariants

- `TimeLock.movable` is always `false`.
- `ScheduleSnapshot` is read-only input for validators and queue actions.
- `QueueAction` must include `snapshotId`, `actor`, `reason`, and `createdAt`.
- `chosenPlanId` must match the plan selected by the user.
- Internal schedule events are not external calendar events.
- Baseline reminders are `system-fallback` or `user-fixed`.
- Agent-refined nudges may add reminders, but cannot delete the baseline reminder.
- Missing notification permission downgrades to in-app-only state.
- Failed reminder delivery is adapter status, not user behavior.
- Soft-task hardening is a scheduling fact, not a moral judgment.
- Frozen cards return through review/reinsertion; they are not deleted or failed.

## Current Implementation Files

- `lib/server/time-guardian/schedule-snapshot-builder.ts`
- `lib/server/time-guardian/time-lock-validator.ts`
- `lib/server/time-guardian/queue-action-validator.ts`
- `lib/server/time-guardian/scheduled-event-inserter.ts`
- `lib/server/time-guardian/reminder-baseline-service.ts`
- `lib/server/time-guardian/reminder-plan-service.ts`
- `lib/server/time-guardian/scheduling-kernel.ts`
- `lib/server/time-guardian/deadline-warning-engine.ts`
- `lib/server/time-guardian/task-tension-classifier.ts`
- `lib/server/time-guardian/freeze-return-service.ts`

## Adapter Slots

The first implementation is local deterministic backend logic. External reminder/calendar work remains behind ports in `lib/server/backend-ports.ts`:

- `TimeGuardianQueuePort`
- `ReminderNotificationPort`
- `CalendarExportPort`

No real Web Push, native alarm, or calendar write is implemented in this slice.

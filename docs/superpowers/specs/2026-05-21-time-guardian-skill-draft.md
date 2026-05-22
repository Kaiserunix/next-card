# Skill Draft: nextcard-time-guardian-queue-actions

```yaml
name: nextcard-time-guardian-queue-actions
description: Use when implementing or reviewing Next Card time scheduling, schedule event insertion, TimeLock protection, QueueAction validation, reminders, deadline warnings, soft-task timing, or frozen-card return behavior
```

## Rules

- Automatic internal event insertion is a core Time Guardian capability.
- Every insertion or mutation must pass through a typed `QueueAction`.
- Build decisions from a versioned `ScheduleSnapshot`.
- Protect `TimeLock`: hard locks cannot be silently moved, overwritten, or invented.
- Baseline reminders are guaranteed: target time minus the user lead time.
- Default baseline lead time is 30 minutes, so `08:00 + default` means reminder at `07:30`.
- Agent-refined nudges can add reminders; they cannot delete baseline reminders.
- If notification permission is missing, create in-app-only reminder state and say so.
- Failed delivery is not user ignoring a reminder.
- Soft-task hardening is schedule evidence, not a moral label.
- Frozen-card return is reinsert/review/keep-frozen, never delete/fail.
- Time Guardian may request proof events; it must not append proof/profile directly.

## Current Verification Commands

```powershell
pnpm test tests/server/time-guardian
pnpm typecheck
pnpm lint
pnpm build
```

## Forbidden User-Facing Language

- lazy
- low self-discipline
- failure tendency
- failed because you delayed
- external reminder is set when permission is missing

## Safe Copy Pattern

```text
This card is approaching its best action window.
Current reminder is in-app only; external notifications are not enabled.
This frozen card can return when a safe window exists.
```

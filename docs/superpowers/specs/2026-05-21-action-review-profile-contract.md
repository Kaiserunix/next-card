# Next Card Action Review / Profile Contract

Date: 2026-05-21
Status: execution contract

## Scope

This contract defines the minimum safe third-layer surface:

```text
verified proof/runtime facts
-> ProofSignalAggregate
-> ProfileSnapshot
-> AgentPolicySnapshot
-> SystemSoftTaskCandidate / ProfileExplanation / ProofSummaryInsight
```

The layer is read-only toward proof and future-facing toward policy. It does not write deck, card, reminder, deadline, hard lock, Time Guardian queue, or proof ledger state.

## Core Types

Implemented in:

```text
lib/server/action-review/types.ts
```

Required unions:

```ts
type RhythmWindowDays = 7 | 14 | 30 | 90;
type ProfileMode = "default" | "explicit-user-choice" | "candidate" | "active";
type ProfileDimensionValue = "unknown" | "low" | "medium" | "high";
type PolicyAppliesTo = "future-planning-only" | "future-reminders-only" | "experiment";
type SystemSoftTaskSource = "profile" | "proof-summary" | "recovery" | "continuation";
```

Required objects:

```text
ProofEventRef
ReminderAuditRef
ProofSignalAggregate
ProfileSnapshot
ProfileDimension
AgentPolicySnapshot
SystemSoftTaskCandidate
ProfileExplanation
ProofSummaryInsight
ProfileGovernanceSettings
```

## Allowed Inputs

- verified proof events
- card runtime transitions
- delivered reminder audit
- user response to delivered reminders
- chosen plan history
- goal contract references
- quality debt references
- Time Guardian decisions as facts

## Excluded Inputs

- raw voice audio
- rejected transcript
- unconfirmed OCR/PDF facts
- failed notification delivery as user response evidence
- missing notification permission as reliable response evidence
- third-party reporting data

## Output Rules

`ProofSignalAggregate` may contain neutral signals only:

```text
firstCardStartDelayMinutes
actualVsEstimatedRatio
freezeRate
burnCompletionRate
deliveredReminderResponseRate
recoveryAfterFreezeMedianMinutes
shortCardCompletionRate
```

`ProfileSnapshot` must be neutral and versioned. Default profile uses:

```text
mode=default
confidence=0
all dimensions=value unknown
userEditable=true
resettable=true
```

`AgentPolicySnapshot` must be future-facing. It may influence:

```text
future first card size
future card minute range
future buffer size
future reminder tone
future nudge daily cap
future burn sensitivity
future freeze recovery style
future optional continuation cards
```

It must not influence:

```text
deadline
hard lock
baseline reminder existence
chosen plan override
proof
baseline goal
standard goal
committed deck/card/reminder
```

`SystemSoftTaskCandidate` must always use:

```text
defaultTension=soft
requiresTimeGuardianReview=true
```

## Forbidden Output Field Names

These names are reserved for red-team checks and forbidden-output documentation. They must not appear as real third-layer output fields:

```text
committedDeck
cardMutation
reminderJob
proofAppend
deadlineMutation
hardLockMutation
timeLockMove
baselineGoalReduction
standardGoalReduction
```

## Fixtures

Fixtures live in:

```text
tests/fixtures/action-review
```

Required fixture set:

```text
empty-proof-default-profile.json
completed-deck-proof-events.json
frozen-then-resumed-proof-events.json
burn-then-completed-proof-events.json
reminder-delivered-and-responded.json
reminder-delivery-failed.json
notification-permission-missing.json
personalization-disabled.json
candidate-profile-low-confidence.json
static-policy-default-balanced.json
```

## Verification

Primary tests:

```powershell
pnpm test tests/server/action-review
pnpm typecheck
```

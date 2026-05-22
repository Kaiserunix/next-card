# Next Card Action Review And Profile Adaptation Plan

Date: 2026-05-21
Status: lightweight third-layer adaptation plan

## Core Judgment

The third layer is not a P0 MVP blocker.

The first layer and second layer decide whether the product works:

```text
Layer 1: understand and confirm input facts
Layer 2: protect time reality and insert schedule events
```

The third layer decides whether the product gets better over time:

```text
Layer 3: read proof evidence
-> summarize rhythm signals
-> produce neutral profile snapshots
-> produce future policy hints
-> optionally create system soft-task candidates
```

So the correct adaptation is:

```text
MVP: very light, mostly static/default, no automatic mutation
V1: low-confidence profile snapshots and bounded policy hints
Experiment: adaptive personalization behind explicit user control
```

## Product Framing

PM/internal name:

```text
行动回顾层
```

Engineering name:

```text
Action Review And Profile Layer
```

Better product framing:

```text
节奏适配层
```

Avoid product language such as:

```text
人格画像
懒惰分析
自律评分
拖延症判断
能力评估
```

## Main Responsibility

The third layer reads verified evidence and produces support strategy.

It does not judge the user.

It does not control time.

It does not write deck/card/reminder/proof state directly.

Its main responsibilities:

- read proof events,
- aggregate action rhythm signals,
- generate a neutral `ProfileSnapshot`,
- generate a versioned `AgentPolicySnapshot`,
- generate optional system soft-task candidates,
- explain why future plans or cards are slightly adjusted,
- support proof summary and user-visible reflection.

## Non-Negotiable Boundaries

1. Profile is a support model, not a psychological diagnosis.
2. Proof is user evidence, not a moral score.
3. Profile must not directly mutate deck, card, reminder, proof, deadline, or hard lock.
4. Profile must not move `TimeLock`.
5. Profile must not delete baseline reminders.
6. Profile must not reduce `baselineGoal` or `standardGoal`.
7. Profile may only shrink `progressGoal` through future policy hints or recovery suggestions.
8. Failed reminder delivery must not be interpreted as user ignoring the reminder.
9. Missing notification permission means reminder-response data is unreliable.
10. MVP should not automatically update active profile from behavior unless the user explicitly enables it.
11. All profile updates must be versioned and reversible.
12. Users must be able to disable personalization and reset profile later.

## Inputs

The third layer may read:

- verified proof events,
- card state transitions,
- completed/deferred/frozen/burning/rewarded events,
- actual duration when available,
- baseline reminder delivery audit,
- user response to delivered reminders,
- user explicit rhythm preferences,
- chosen A/B/C plan history,
- goal contract and quality debt,
- Time Guardian decisions as facts, not as user blame.

It must not use:

- raw voice audio,
- rejected transcript,
- unconfirmed OCR/PDF facts,
- failed notification delivery as behavior evidence,
- sensitive third-party information unless needed and consented,
- school/parent/third-party reporting channels.

## Outputs

Allowed outputs:

- `ProofSignalAggregate`
- `ProfileSnapshot`
- `AgentPolicySnapshot`
- `SystemSoftTaskCandidate`
- `ProfileExplanation`
- `ProofSummaryInsight`

Forbidden direct outputs:

- committed deck mutation,
- card state mutation,
- reminder job mutation,
- hard lock mutation,
- proof event fabrication,
- external report,
- user label such as lazy/low-discipline.

## Service Split

Recommended split:

```text
Proof Event Reader
-> Signal Normalizer
-> Profile Aggregator
-> Policy Engine
-> System Soft Task Candidate Generator
-> Explanation Builder
-> Profile Governance Service
```

### Proof Event Reader

Reads append-only proof events.

Can read:

- completed,
- deferred,
- frozen,
- burned,
- rescheduled,
- rewarded,
- reminder_delivered,
- summary_accepted.

Cannot fabricate or delete proof.

### Signal Normalizer

Turns proof facts into neutral signals.

Examples:

```text
first_card_start_delay
actual_vs_estimated_duration_ratio
freeze_after_burn_count
reminder_response_after_delivered
short_card_completion_rate
recovery_after_freeze_interval
```

Signals are not labels.

### Profile Aggregator

Aggregates low-resolution support dimensions:

```text
activationSupportLevel
timeEstimateCalibration
progressRhythm
reminderPressureFit
```

MVP default:

```text
unknown
confidence = 0
evidenceCount = 0
```

V1 may update after a deck completes or once per day at most.

### Policy Engine

Converts profile snapshot into future planning hints.

Allowed influence:

- first card size,
- card minute range,
- buffer size,
- reminder tone,
- nudge frequency cap,
- burn sensitivity,
- freeze recovery style,
- whether to suggest optional continuation cards.

Forbidden influence:

- deadline,
- hard lock,
- baseline reminder existence,
- chosen plan override,
- proof,
- baseline/standard goal.

### System Soft Task Candidate Generator

May create system-generated soft-task candidates from proof/profile.

Examples:

- review task,
- recovery task,
- preparation task,
- continuation task,
- summary/reflection task.

Rules:

- all system-generated tasks are soft by default,
- they enter deck library as candidates,
- Time Guardian decides when to surface them,
- they must not appear as mandatory before Time Guardian hardening,
- they must not shame the user.

### Explanation Builder

Creates user-readable reasons without exposing agents.

Good copy:

```text
这次先给你一张更短的启动卡。
这个任务会多留一点缓冲时间。
这张卡适合先恢复上下文，再继续。
```

Forbidden copy:

```text
因为你很拖延。
因为你自律较低。
你的执行力评分下降。
```

### Profile Governance Service

Owns safety and control:

- profile versioning,
- opt-in/opt-out,
- reset,
- evidence window,
- confidence threshold,
- local-first storage,
- experiment flags.

## Core Data Structures

### ProofSignalAggregate

```ts
type ProofSignalAggregate = {
  id: string;
  userId: string;
  windowDays: 7 | 14 | 30 | 90;
  createdAt: string;
  evidenceEventIds: string[];
  signals: {
    firstCardStartDelayMinutes?: number;
    actualVsEstimatedRatio?: number;
    freezeRate?: number;
    burnCompletionRate?: number;
    deliveredReminderResponseRate?: number;
    recoveryAfterFreezeMedianMinutes?: number;
    shortCardCompletionRate?: number;
  };
  dataQuality: {
    evidenceCount: number;
    reminderDeliveryReliable: boolean;
    hasEnoughData: boolean;
  };
};
```

### ProfileSnapshot

```ts
type ProfileSnapshot = {
  id: string;
  userId: string;
  version: number;
  createdAt: string;
  evidenceWindowDays: 7 | 14 | 30 | 90;
  confidence: number;
  mode: "default" | "explicit-user-choice" | "candidate" | "active";
  dimensions: {
    activationSupportLevel: ProfileDimension;
    timeEstimateCalibration: ProfileDimension;
    progressRhythm: ProfileDimension;
    reminderPressureFit: ProfileDimension;
  };
  evidenceIds: string[];
  userEditable: boolean;
  resettable: boolean;
};

type ProfileDimension = {
  value: "unknown" | "low" | "medium" | "high";
  confidence: number;
  evidenceCount: number;
  lastUpdatedAt: string;
};
```

### AgentPolicySnapshot

```ts
type AgentPolicySnapshot = {
  id: string;
  profileSnapshotId: string;
  version: number;
  createdAt: string;
  appliesTo: "future-planning-only" | "future-reminders-only" | "experiment";
  planIntensity: "minimal" | "balanced" | "sprint";
  cardGranularity: "micro" | "standard" | "dense";
  cardMinuteRange: [number, number];
  bufferMultiplier: number;
  reminderStrictness: "light" | "normal" | "strong";
  nudgeDailyCap: number;
  burnSensitivity: number;
  freezeRecoveryStyle: "resume-context" | "smaller-first-card" | "ask-user";
  explanation: string;
};
```

### SystemSoftTaskCandidate

```ts
type SystemSoftTaskCandidate = {
  id: string;
  source: "profile" | "proof-summary" | "recovery" | "continuation";
  title: string;
  reason: string;
  defaultTension: "soft";
  suggestedWindow?: string;
  evidenceIds: string[];
  requiresTimeGuardianReview: true;
};
```

## MVP Adaptation

MVP should implement the third layer as a thin, safe adapter:

```text
Proof events
-> default ProfileSnapshot
-> static AgentPolicySnapshot
-> explanation strings
```

MVP rules:

- profile auto-update disabled by default,
- all dimensions start as `unknown`,
- users may choose a simple initial rhythm preference,
- policy only affects future candidate generation,
- no automatic profile-driven schedule rewrite,
- no automatic system soft tasks unless behind a flag,
- no visible personality profile page required.

Recommended MVP presets:

```text
default-balanced
low-pressure-start
short-card-focus
more-buffer
light-reminders
```

These are user preference presets, not inferred personality types.

## V1 Adaptation

V1 can add low-confidence aggregation:

- update only after deck completion or once per day,
- require minimum evidence count,
- never use failed reminder delivery as user behavior,
- never update hard locks or deadlines,
- produce candidate profile first,
- require user acceptance before becoming active if confidence is low.

V1 can generate:

- smaller first card suggestions,
- buffer adjustment hints,
- freeze recovery style,
- light system soft-task candidates.

## Experiment Adaptation

Experiment features must be behind feature flags:

- rolling 14/30/90-day profile updates,
- adaptive reminder intensity,
- adaptive card granularity,
- system-generated recovery tasks,
- profile preset generation,
- user-visible rhythm preference page,
- profile reset and audit view.

Experiment safety:

- user can disable personalization,
- user can reset profile,
- changes are versioned,
- no third-party reporting,
- no moral score,
- no diagnosis,
- no direct mutation of committed deck/card/reminder/proof.

## Interaction With Layer 1

Layer 1 may read current policy snapshot to shape future candidates.

Allowed:

- smaller first-step candidate,
- more direct fact confirmation,
- lighter clarification style,
- shorter initial deck draft.

Forbidden:

- skipping A/B/C Plan Mode,
- silently changing user input,
- hiding missing time/location facts,
- using profile to accept low-confidence extraction.

## Interaction With Layer 2

Layer 2 may read policy snapshot.

Allowed:

- buffer multiplier,
- reminder tone,
- nudge cap,
- freeze recovery style,
- card granularity.

Forbidden:

- moving `TimeLock`,
- deleting baseline reminder,
- changing deadline,
- creating external notification without permission,
- treating profile as schedule authority.

## Acceptance Criteria

1. Default profile has all dimensions `unknown` and confidence `0`.
2. Profile cannot directly mutate deck/card/reminder/proof.
3. Policy snapshot is versioned and future-facing.
4. Failed reminder delivery is excluded from reminder response signals.
5. Proof events are read-only; third layer cannot fabricate proof.
6. No user-facing lazy/discipline/personality-score labels exist.
7. `baselineGoal` and `standardGoal` cannot be reduced by profile.
8. System-generated tasks are soft candidates and require Time Guardian review.
9. Users can disable or reset personalization in V1/experiment.
10. All explanations are support-language, not judgment-language.

## Suggested Later Execution Packages

Only split these after first and second layer execution plans are stable:

1. Profile contracts and default snapshot.
2. Proof signal aggregate.
3. Static policy engine.
4. System soft-task candidate generator.
5. Explanation builder.
6. Profile governance and reset controls.
7. Red-team tests and skill draft.

## Decision For Now

Recommended current decision:

```text
Do not make third layer a heavy implementation track yet.
Write contracts and default policy only after Layer 1/2 contracts stabilize.
Keep profile auto-update disabled by default.
Use third layer mainly as a future policy adapter and proof summary helper.
```

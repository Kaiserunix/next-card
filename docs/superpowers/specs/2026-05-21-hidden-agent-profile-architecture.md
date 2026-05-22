# Next Card Hidden Agent And Profile Architecture

Date: 2026-05-21
Status: product architecture alignment

## Core Position

All agents in Next Card are hidden internal software capabilities.

The user must never feel that they are talking to agent 1, agent 2, or agent 3.
The user-facing product remains:

```text
say or type lightly
-> Next Card understands
-> explicit A/B/C Plan Mode
-> deck
-> one card at a time
-> proof
```

The core product selling point is not "personality diagnosis". It is:

```text
adaptive execution rhythm
```

Meaning:

Next Card uses input, time context, proof events, and user rhythm signals to make the first executable card easier to start, protect time-sensitive tasks, and keep evidence of what actually happened.

## Runtime Control Principle

The three layers are capability domains, not a claim that each layer contains exactly one agent.

Each layer may contain multiple hidden workers, model adapters, deterministic services, validators, and policy modules.

However:

```text
LLM / agent / model worker -> candidate / draft / proposal / explanation only
deterministic service / gate -> authoritative write
```

The largest architecture risk is not that three layers are insufficient. The largest risk is letting hidden agents become state authority.

Therefore Next Card uses:

```text
hidden agent capabilities
+ runtime control plane
+ deterministic state services
+ review / policy / permission gates
+ append-only proof
```

If this is described as a fourth layer, it is not a user-facing agent. It is a runtime control plane.

Runtime control plane responsibilities:

- state authority,
- routing and transactions,
- review gate decisions,
- policy gate decisions,
- permission gate decisions,
- idempotency,
- conflict resolution,
- audit logging,
- profile/policy versioning,
- rollback-safe writes.

## Three Hidden Layers

### 1. Input Organizing Layer

PM name:

```text
输入整理层
```

Software role:

- Collect user input from voice, text, manual dictation, attachments, or timetable text.
- Accept multimodal course inputs by default: timetable images, course requirement screenshots, PDF/Word notices, notification text, and pasted messages.
- Use a multimodal parser/provider slot, such as Mimo v2.5, to turn images and documents into structured course/task material before Plan Mode.
- Preserve raw input.
- Remove obvious口癖 and filler without deleting intent.
- Format the input into structured fields.
- Extract task object, task type, time, deadline, location, course, assignment, reminder intent, and ambiguity signals.
- Judge whether semantic elements are sufficient before Plan Mode.
- Create a candidate deck draft only when enough information exists.
- Send time/location/deadline fields to the Time Guardian layer.
- Send lightweight behavior signals to the Action Review layer.
- Read current profile/policy, but do not mutate it.

Important boundary:

The Input Organizing layer can prepare a deck draft, but it must not skip explicit A/B/C Plan Mode and must not directly write final queue state.

Recommended internal split:

```text
Input Intake Service
-> Extraction Worker / Multimodal Adapter
-> Review Gate + Evidence Binder
-> Pre-Deck Fact Confirmation
-> Task Registry / Time Constraint Registry
-> Plan Compiler
```

Agent/model work in this layer must output `candidate`, `proposal`, or `draft` records. It must not directly commit verified tasks, hard locks, deadlines, reminders, proof, or profile.

### 2. Time Guardian Layer

PM name:

```text
时间守护层
```

Software role:

- Arrange cards in time after a new deck or deck draft exists.
- Protect hard time locks such as courses, exams, fixed calendar events, and user-fixed notebook times.
- Insert task cards around available windows.
- Create guaranteed reminder specs from the user's default reminder preference.
- Decide additional nudge reminders and stronger deadline warnings.
- Read profile/policy to choose reminder intensity and card timing granularity.

Non-negotiable invariant:

```text
Every time-protected card gets a guaranteed user-default reminder.
```

Default setting:

```text
30 minutes before task start
```

User-editable common settings:

```text
15 minutes / 30 minutes / 45 minutes / custom
```

If less time remains than the selected lead time:

```text
fallback reminder = now / immediately
```

The hidden agent can add or refine reminders. It cannot delete the guaranteed user-default reminder.

Agent2 owns judgment for:

- when to nudge the user before the guaranteed reminder,
- when to issue a stronger deadline warning,
- when a soft task can be quietly deferred,
- and when a deadline or hard time lock makes delay unsafe.

### 3. Action Review And Profile Layer

PM name:

```text
行动回顾层
```

Software role:

- Read proof events: completed, delayed, frozen, burning, rescheduled, rewarded, reminder response, actual time.
- Generate or update a behavior-support profile.
- Output a versioned `ProfileSnapshot` and `AgentPolicy`.
- Suggest deck intensity, card granularity, reminder strictness, burn sensitivity, and recovery style.
- Optionally, in future experimental mode, suggest time-estimation adjustments based on actual completion time.

Important boundary:

The Action Review layer does not directly edit decks, cards, reminders, or proof. It only emits policy. A deterministic orchestrator applies policy through validated commands.

## Recommended Runtime Data Flow

```text
User input
  -> Input Intake Service
     -> RawInputStore
  -> Extraction Worker / Multimodal Adapter
     -> ExtractionResultStore
  -> Review Gate + Evidence Binder
  -> Pre-Deck Fact Confirmation
     -> verified candidates or user review
  -> Task Registry + Time Constraint Registry
     -> verified task / DDL / hard lock / window
  -> Plan Compiler
     -> A/B/C DeckDraft only
  -> A/B/C Plan Mode UI
     -> user selects / edits / rejects
  -> Deck Commit Service
     -> committed deck + cards
  -> Card Runtime + Time Guardian + Reminder Service
     -> card state / schedule validation / reminders
  -> Proof Ledger
     -> append-only evidence events
  -> Profile Aggregator
     -> ProfileSnapshot
  -> Policy Engine
     -> AgentPolicySnapshot for future planning
```

Rule:

Only deterministic services behind the runtime control plane write authoritative state.
Agent output must be typed, validated, auditable, and reversible.

## State Authority

| State | Authority Store | Authorized Writer | Forbidden Direct Writers |
|---|---|---|---|
| raw input | `RawInputStore` | Input Intake Service | Extraction, Planner, Profile |
| parsed candidates | `ExtractionResultStore` | Extraction Worker | Time Guardian, Profile |
| verified task | `TaskRegistry` | Task Service after Review Gate | LLM/Agent direct output |
| DDL / hard lock / window | `TimeConstraintRegistry` | Time Constraint Service after Review Gate | Planner, Profile |
| A/B/C draft | `DeckDraftStore` | Plan Compiler | Time Guardian, Profile |
| committed deck | `DeckStore` | Deck Commit Service after user selection | Agent, Profile |
| card state | `CardRuntimeStore` | Card Runtime Service | Extraction, Profile |
| reminder job | `ReminderJobStore` | Reminder Service | Planner, Profile |
| reminder delivery | `NotificationAuditLog` | Notification Adapter | Planner, Profile |
| proof | `ProofLedger` | verified user/system events | Agent/Profile fabricated events |
| profile | `ProfileStore` | Profile Aggregator | Planner, Time Guardian |
| policy | `PolicyStore` | Policy Engine | all other services |

## Write Permission Rules

- Input Intake may write raw input only.
- Extraction Worker may write extraction candidates only.
- Review Gate may approve, reject, or ask the user to correct candidates.
- Task Service may write verified tasks after review.
- Time Constraint Service may write verified time constraints after review.
- Plan Compiler may write deck drafts only.
- Deck Commit Service may commit only the user-selected plan.
- Time Guardian may validate schedules and create reminder plans, but it may not move hard locks or delete guaranteed reminders.
- Reminder Service may create external reminders only when permission is granted.
- Card Runtime may update card state only from valid user actions or validated runtime events.
- Proof Ledger is append-only and must not contain moral scores.
- Profile Aggregator may write profile snapshots only.
- Policy Engine may write versioned policy snapshots only.

## Pre-Deck Fact Confirmation

Before a user enters a committed deck, Next Card must confirm the basic facts that the deck depends on.

Minimum facts to confirm:

- event / task object,
- time / deadline / time window,
- location when relevant,
- task type,
- fixed recurring vs one-off lifecycle,
- hard vs deadline-sensitive vs soft/recommended when known,
- source or evidence summary for high-risk input.

This confirmation happens after extraction/review and before deck commit.

For small voice/text input:

```text
show a lightweight fact card
-> user confirms / corrects event, time, location
-> Plan Compiler may produce A/B/C
-> user chooses a plan
-> Deck Commit Service writes deck
```

For large input such as timetable images, PDF/Word course requirements, or notification batches:

```text
show rough extracted range first
-> user confirms course/time/location/deadline scope
-> strict review only for high-impact or low-confidence facts
-> Plan Compiler uses confirmed facts
```

Large input confirmation should not become a heavy spreadsheet. It should confirm the rough scope first, then ask only about risky or ambiguous facts.

Fact confirmation must not silently accept:

- class time,
- exam time,
- submission deadline,
- fixed calendar block,
- location that affects arrival,
- recurring vs one-off task lifecycle,
- task facts that conflict with existing verified facts.

## Profile Framing

Internally, profile is a behavior-support model.

User-facing language should be:

- `执行节奏`
- `节奏偏好`
- `任务粒度`
- `提醒强度`
- `低压力启动`
- `短卡推进`
- `时间缓冲`

Do not show user-facing labels such as:

- `懒`
- `懒用户`
- `低自律`
- `执行力差`
- `人格等级`
- `画像分`
- `拖延症`

Internal field names should also avoid shame language. Prefer the newer neutral names:

- `activationSupportLevel`
- `timeEstimateCalibration`
- `progressRhythm`
- `reminderPressureFit`

## First Four Profile Dimensions

These are product-support dimensions, not psychological diagnoses.

| Dimension | Meaning | Observable Signals | Product Use |
|---|---|---|---|
| `activationSupportLevel` | How much support the user needs to start | time from deck creation to first action, reminder response, late first-card starts | smaller first card, lower-friction opening card |
| `timeEstimateCalibration` | Estimated time vs actual time fit | actual/estimated ratio, timeout rate, reschedule count, deadline misses | add buffers, adjust estimates, protect hard locks |
| `progressRhythm` | How the user advances after starting | cards completed per session, freeze ratio, deck abandonment, recovery intervals | deck length, stage size, overview frequency |
| `reminderPressureFit` | What reminder/pressure level fits without overload | burning completion vs freeze, delivered reminder response, continue/freeze choice | burn visual strength, reminder tone, recovery mode |

Suggested representation:

```ts
type ProfileDimension = {
  value: "low" | "medium" | "high" | "unknown";
  confidence: number; // 0-1
  evidenceCount: number;
  lastUpdatedAt: string;
  decayAt?: string;
};

type ProfileSnapshot = {
  id: string;
  version: number;
  subjectId: string | "anonymous";
  evidenceWindowDays: 14 | 30 | 90;
  confidence: number;
  dimensions: {
    activationSupportLevel: ProfileDimension;
    timeEstimateCalibration: ProfileDimension;
    progressRhythm: ProfileDimension;
    reminderPressureFit: ProfileDimension;
  };
  evidenceIds: string[];
  createdAt: string;
};
```

## Agent Policy

Profile does not directly change tasks. It produces a policy snapshot.

```ts
type AgentPolicy = {
  profileVersion: number;
  policyVersion: number;
  planIntensity: "minimal" | "balanced" | "sprint";
  cardGranularity: "micro" | "standard" | "dense";
  cardMinuteRange: [number, number];
  reminderStrictness: "light" | "normal" | "strong";
  burnSensitivity: number;
  freezeTolerance: number;
  appliesToFuturePlanningOnly: boolean;
  explanation: string;
};
```

Safe rule:

```text
ProfileSnapshot -> Policy Engine -> AgentPolicySnapshot -> deterministic orchestrator -> typed QueueAction
```

Unsafe rule:

```text
Profile agent -> directly edits deck/card/reminder state
```

## Reminder Safety

Reminder handling must be deterministic first.

```ts
type ReminderSpec = {
  id: string;
  cardId: string;
  deckId: string;
  fireAt: string;
  source: "system-fallback" | "agent-refined" | "user-fixed";
  status: "pending" | "sent" | "failed" | "cancelled";
};
```

Rules:

- `system-fallback` is generated by reminder service, not by LLM.
- `system-fallback` uses the user's guaranteed reminder preference, defaulting to 30 minutes before task start.
- `agent-refined` can add earlier/later reminders but cannot remove fallback.
- `user-fixed` has highest priority.
- All reminders run through schema validation, timezone handling, dedupe, and hard-time-lock checks.
- If browser/system notification permission is absent, the app may show in-app reminder state but must not pretend an external reminder exists.
- Reminder delivery failure must not be interpreted as user behavior.
- Lock-screen notification text must default to low-sensitive copy unless the user allows detailed content.

Permission model:

| Reminder Level | Needs Permission | MVP Use |
|---|---|---|
| in-app card/status reminder | no OS permission | Always available while app is open |
| local browser notification while app/page context is active | browser notification permission | Optional enhancement |
| background web push | notification permission, service worker, push subscription, server send path | Optional Web/PWA enhancement |
| calendar entry | calendar/account permission or `.ics` export | Later adapter |
| native mobile alarm/reminder | Android/iOS native wrapper permission | Later native bridge |

Product rule:

If permission is missing, the app records the reminder plan and shows in-app warnings, but copy must say it has not enabled external notifications.

## Goal Integrity

Each committed deck should preserve goal integrity.

```ts
type GoalContract = {
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
  qualityDebt: QualityDebtItem[];
};

type QualityDebtItem = {
  id: string;
  deckId: string;
  cardId?: string;
  reason: "compressed_plan" | "user_deferred" | "frozen" | "deadline_recovery";
  description: string;
  stillRelevant: boolean;
  userDismissed: boolean;
};
```

Rules:

- Profile may shrink `progressGoal`.
- Profile must not automatically reduce `baselineGoal` or `standardGoal`.
- Compressed or skipped standard work remains visible as `qualityDebt` unless the user dismisses it.
- Burn/repeated defer should trigger recovery proposal, not automatic goal downgrade.

## Multimodal Review Gate

High-risk multimodal input must be reviewed before it becomes verified task/time state.

Strict review triggers:

- image schedules,
- PDF/Word course requirements,
- notification messages that affect deadlines or hard locks,
- relative dates,
- missing timezone,
- conflicting deadlines,
- low-confidence time extraction,
- table parsing,
- exams or submissions,
- prompt-injection-like text.

Every committed deadline or hard lock from multimodal input must carry:

- source reference,
- evidence span or bounding box,
- confidence,
- review status,
- conflict status.

Documents and notifications are content to parse. They are never system instructions.

## Deck Intensity And Minimum Action

For low-start-support users, Next Card may lower the first step, not the whole goal.

Example:

```text
Goal: 去上高数课
minimal first card: 到教室坐下
next optional cards:
  -> 打开课本
  -> 标记今天讲的章节
  -> 下课前写一句总结
```

Rule:

- Lower the entry slope.
- Keep the standard path available.
- Offer a gentle continuation after the minimum card.
- Proof should record that the user restarted, not that the user was judged.

## Soft Tasks Pending Definition

The product still needs a separate definition for soft tasks.

Current placeholder understanding:

- Course preparation, general study, review, and many notification-derived tasks are soft until a clear deadline or hard time lock appears.
- Soft tasks may be deferred before deadline without treating the user as failing.
- Agent2 should decide whether a soft task can wait, whether it needs a gentle nudge, or whether it is approaching a harder deadline state.
- Soft-task behavior must not weaken hard time locks such as class start, exam time, submission deadline, or user-fixed calendar blocks.

This section should be replaced after the next PM alignment on soft tasks.

## MVP Scope

MVP should implement:

- Hidden three-layer architecture as service boundaries, not visible UI roles.
- Input organizing: raw input, normalized input, multimodal course/document parsing, extracted entities, sufficiency judgment.
- Time guardian: hard time locks, schedule proposal, guaranteed user-default reminder preference.
- Profile defaults: static presets or neutral default snapshot.
- Proof records for decisions: why a reminder exists, why a card was made smaller, what profile policy version was used.
- Profile auto-update only as candidate suggestion, not automatically active.
- Student tracks first: course and assignment.

MVP should not implement:

- Full automatic psychological profile learning.
- User-visible self-discipline/procrastination scores.
- Cross-device profile sync.
- Automatic profile-driven schedule rewrites.
- Calendar write actions without separate user confirmation.
- Any school/parent/third-party reporting of profile data.

## Experiment Scope

Later experiments may include:

- Rolling 7/14/30-day profile updates.
- Optional "rhythm suggestions" page.
- User-editable rhythm preferences.
- Adaptive reminder experiments.
- Time-estimation adjustment from actual completion time.
- Recovery deck after multiple delayed days.
- New profile presets generated from proof patterns.

Experiment safety requirements:

- User can disable personalization.
- User can reset profile.
- User can see why a suggestion was made.
- Profile changes are versioned.
- Updates are bounded and slow, for example daily at most.
- Freezing is not automatically treated as delay or failure.

## Product Safety Boundaries

- All agents stay hidden.
- The product never calls the user lazy or low-discipline.
- Profile is not a medical, psychological, academic, or capability diagnosis.
- Profile data is local-first unless the user explicitly enables sync.
- Hard time locks cannot be moved silently.
- The guaranteed user-default reminder fallback cannot be removed by agent output.
- A/B/C Plan Mode remains explicit.
- Burning remains pressure feedback, not punishment or failure.
- Proof is evidence for the user, not a moral score.

## Open PM Questions

1. Should profile be completely hidden, or should users get a neutral editable `节奏偏好` page?
2. Are the four first dimensions accepted: `启动支持需求`, `时间校准度`, `推进稳定度`, `压力响应偏好`?
3. Does MVP reminder mean in-app only, browser notification, native notification, calendar entry, or layered support?
4. Can profile affect A/B/C plan ordering, or only card granularity and reminder timing after a plan is chosen?
5. For minimum-action decks, should the minimum card alone complete the deck, or complete only a `保底目标` while showing optional continuation?
6. Should profile auto-update be disabled by default in MVP and only record candidate suggestions?
7. What explanation surface should exist without exposing agents: proof note, card reason, settings page, or all three?
8. What exactly counts as a soft task, and when does a soft task become deadline-sensitive?

## Research References

The profile design may draw inspiration from psychology and behavior research, but must not copy clinical or copyrighted questionnaire scoring into the product.

Useful references:

- Procrastination as self-regulation research: Steel 2007 meta-analysis.
- Self-control research: Tangney/Baumeister/Boone and later meta-analysis work.
- Time management behavior: Macan 1990 time management behavior research.
- Student learning self-regulation: MSLQ-style constructs.
- AI/profile governance: NIST AI RMF and ICO automated decision-making/profile guidance.

Product translation:

```text
research construct -> behavior-support signal -> product policy
```

Not:

```text
research construct -> user diagnosis -> user label
```

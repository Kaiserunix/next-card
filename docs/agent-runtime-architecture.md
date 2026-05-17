# Agent Runtime Architecture

Next Card uses agents as a runtime architecture, not as chat personas. A profile
is a policy bundle plus skill weights; queue mutation remains centralized and
auditable.

## Layers

```text
User input / timetable / notice / image
  -> Mimo backend agents
  -> Queue orchestrator agent
  -> Provider dispatch
  -> Proof records

Behavior profiles feed policy into the queue orchestrator, but do not directly
write queue state.
```

### 1. Mimo Backend Agents

`mimo-v2.5-pro` owns Plan Mode:

- goal understanding
- missing information
- time judgement
- three plan choices

`mimo-v2.5` owns multimodal import parsing:

- timetable / notice / image timetable parsing
- top-level card extraction
- coverage checks
- mandatory review gate for large imports

Mimo agents return `PlanModeTurnResult` or `ImportReviewResult`. They do not
directly insert, move, or delete queue items.

### 2. Queue Orchestrator Agent

The orchestrator owns queue mutation through `QueueAction`.

Primary skills:

- `priority-score`
- `time-lock-guard`
- `schedule-insert`
- `freeze-return`
- `hidden-goal-reveal`
- `reminder-calendar-sync`

Hard time locks are protected by `time-lock-guard`. User-fixed notebook,
calendar busy blocks, and hard deadlines cannot be silently moved. The
orchestrator may suggest changes or require review.

### 3. Behavior Agent Profiles

The six local profiles tune how cards are split and presented:

| Profile | Dominant skills |
|---|---|
| 平衡教练 | balanced decomposition, proof writing |
| 截止线守卫 | deadline protect, burn pressure |
| 微动作拆解师 | micro decompose, review gate |
| 冲刺推进器 | deadline protect, micro decompose, burn pressure |
| 温和恢复师 | freeze recovery, low-pressure restart |
| 意义唤醒师 | meaning reframe, proof writing |

Profiles pass `AgentPolicy + skillWeights` into the orchestrator. They do not
act as independent workers.

## Skill Registry

The canonical registry is:

```text
lib/server/agent-runtime.ts
```

Skill groups:

- Mimo skills: `goal-plan`, `multimodal-import`, `coverage-review`
- Guard/review skills: `review-gate`, `time-lock-guard`
- Queue skills: `priority-score`, `schedule-insert`, `freeze-return`, `hidden-goal-reveal`
- Provider skills: `reminder-calendar-sync`
- Behavior skills: `micro-decompose`, `deadline-protect`, `burn-pressure`, `freeze-recovery`, `proof-writing`, `meaning-reframe`

## Automatic Triggers

| Trigger | Cadence | Main skills |
|---|---|---|
| `goal-submitted` | immediate | `goal-plan`, behavior profile skills |
| `large-import-received` | immediate | `multimodal-import`, `coverage-review`, `review-gate` |
| `worker-tick` | every 5 minutes | `priority-score`, `time-lock-guard`, `schedule-insert`, provider sync |
| `freeze-return-due` | threshold | `freeze-return`, `priority-score`, `time-lock-guard` |
| `urgency-threshold` | threshold | `deadline-protect`, `burn-pressure`, reminders |
| `card-completed` | immediate | `proof-writing`, queue continuation |

The first production worker should call `buildAgentRuntimePlan()` before
dispatching real `QueueAction`s. This keeps the trigger path explicit and makes
it easy to audit why an action appeared.

## Safety Rules

- Mimo agents cannot write queue state directly.
- Large multimodal imports require one user review gate.
- Only queue orchestrator emits queue mutations.
- `time-lock-guard` must run before `schedule-insert`.
- Provider dispatch executes reminder/calendar actions; it does not decide task priority.
- Proof is a first-class output of agent work, not a secondary log.

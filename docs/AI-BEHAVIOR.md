# Next Card AI Behavior Contract

This document captures the backend planning rules that both `lib/mock-ai.ts`
and any future real planning adapter must follow. It is the producer-side
contract for the UI components and Zustand store.

## Frontend Contract

The planner must always produce stable, non-empty data for these consumers:

| Consumer | Required planner output |
|---|---|
| `PlanModePanel` time chips | `deadlineLabel`, `availableWindow`, and `suggestedStart` as non-empty strings |
| Plan options | Exactly three plans: `plan-1`, `plan-2`, `plan-3` |
| Plan styles | `urgent`, `balanced`, `gentle`, in that order |
| Plan steps | Four concrete action steps per plan |
| `TaskFlowOverview` | Up to four nodes, each with `timeLabel` and `urgencyStage` |
| Deck generation | Up to six action cards, never broad goals |
| Card timing | Every card has either `deadlineAt` or `suggestedStartAt`, plus an urgency stage |
| Proof generation | Every meaningful action creates readable evidence, not just counters |

If a future backend cannot satisfy the contract, it should fall back to the
mock planner and record a soft notice in proof instead of crashing the app.

## Planning Order

The planning flow must stay Codex Plan Mode-like:

1. Understand the user's goal and source type.
2. Extract constraints, especially time, deadline, dependencies, and energy pressure.
3. Decompose the goal into action stages.
4. Explain the time strategy, including what can be frozen or rescheduled.
5. Offer exactly three execution plans.

Do not skip straight from input to a pile of task cards.

## Task Classification

Use the smallest useful card deck:

| Class | Meaning | Card guidance |
|---|---|---|
| Meta task | One continuous action, obvious completion | 1-2 cards |
| Simple complex task | One goal with 2-3 stages | 3-4 cards |
| Multi-stage task | Cross-time, multi-source, or milestone-based | 4-6 cards |

Signals that raise complexity include explicit dates, several verbs, several
objects, exam/project/report keywords, multiple sources, and estimated effort
above 30 minutes.

## Track Library

Current and future planners should prefer these tracks:

| Track | Trigger examples | Baseline strategy |
|---|---|---|
| `course` | 高数, 上课, 课表, 教室, lecture | Prepare now, leave, arrive, do a pre-class action |
| `assignment` | 作业, 提交, 截止, ddl, deadline, report | Minimum viable submission first, polish later |
| `routine` | 收拾, 回复, 吃药, 喝水, 起床 | Keep it tiny; 1-3 cards only |
| `learning` | 学, 复习, 预习, 背, 刷题 | Pick material, progress one unit, self-check |
| `project` | 项目, 答辩, 比赛, 演讲, 上线 | Milestone split, main push, proof-preserving close |
| `default` | No strong trigger | Start within 25 minutes with a gentle fallback time |

When several tracks match, choose the one that best protects the user's next
real-world deadline. `course` with an attached assignment should still keep the
course rhythm, but the first card should confirm what must be brought or handed in.

## Card Rules

Every generated card must be an already-decomposed next action:

- Good: `打开作业要求，圈出必须提交的 3 个点。`
- Good: `整理高数课本和上次作业页，准备出门。`
- Bad: `学习数学`
- Bad: `完成作业`

The first card should be the lowest-friction starter action. The last card
should leave proof or context: save the draft, write the next step, or check
what remains.

## Time And Damage

Urgency stages must be one of:

```text
calm / warm / hot / burning / expired
```

Damage effects must be one of:

```text
none / burn / freeze / crack / weathering
```

Burn and crack are evidence of time pressure, not punishment. Burning must not
hide card text. Freeze always means the task context is saved and can be resumed.

## Required Mock Coverage

The mock planner should keep stable coverage for:

- One-sentence goals without explicit time.
- Assignment notices and pasted deadlines.
- Mock image timetable parsing.
- Mixed text plus attachment/image sources.
- `去高数课`, with a `course` deck cover and a first card in a burning demo window.

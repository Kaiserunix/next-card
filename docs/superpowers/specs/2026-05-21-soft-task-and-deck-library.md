# Next Card Soft Task And Deck Library Concept

Date: 2026-05-21
Status: PM alignment draft

## Core Correction

The deck library is not primarily a template library.

It is the canonical task/deck data library:

```text
all generated tasks
all generated decks
fixed recurring tasks
one-off user tasks
system-generated soft tasks
frozen decks/cards waiting for rescheduling
future scheduled deck entries
```

The user-facing experience can show this as a proof-side todo overview or deck overview, but active execution must still happen one card at a time.

## Soft Task Definition

A soft task is a task that is not urgent enough to force immediate execution before Agent2's recommended good action line.

Before the good line:

```text
soft task = optional
```

After the good line:

```text
soft task = required / pushed repeatedly / deadline-sensitive
```

This means soft tasks are not simply "tasks without deadlines". A task can have a deadline and still be soft while it remains flexible.

Soft-task signals:

- no clear deadline,
- deadline exists but still has flexible execution space,
- task does not currently affect a hard real-world event,
- task can be deferred without breaking class, submission, exam, or a user-fixed time block.

Hardening triggers:

- Agent2 judges that the task has passed its recommended good action line,
- the task approaches deadline,
- the task begins to affect class, submission, exam, or fixed calendar time,
- the user marks it as no longer deferrable.

## Good Line

Agent2 must define a `recommendedGoodLine` for soft tasks with time relevance.

Suggested fields:

```ts
type SoftTaskTiming = {
  recommendedGoodLineAt: string | null;
  mustNudgeAfterAt: string | null;
  deadlineAt: string | null;
  hardensAt: string | null;
  reason: string;
};
```

Before `recommendedGoodLineAt`, the task may appear as an optional card or quiet suggestion.

After `recommendedGoodLineAt`, Agent2 may increase nudge frequency.

After `hardensAt`, the task is no longer treated as a normal soft task.

User-facing visibility:

```text
recommendedGoodLineAt / hardensAt are formatted into the proof-side timeline.
They are visible through the deck-library/proof representation, not as raw technical field names.
The timeline should explain why the task tension changed, when the recommended action window begins, and when it becomes harder to defer.
```

## Task Tension Levels

Tasks need a tension/urgency hierarchy from high to low.

Initial concept:

```text
hard / must-do task
deadline-sensitive task
recommended task
soft optional task
background candidate
```

Examples:

- `上课打卡`, class start, exam, submission deadline: hard / must-do.
- assignment preparation before the last safe window: soft or recommended.
- review, preview, material organization: soft optional until Agent2 hardens it.
- Agent3-generated improvement tasks: system-generated soft tasks by default.

External display rule:

```text
Do not rely on user-facing tension names as the primary signal.
Use color to distinguish task tension externally.
Internal level names may remain hard / deadline-sensitive / recommended / soft / background for scheduling and tests.
```

## Deck Library

The deck library stores generated deck data.

It includes:

- user-generated tasks and decks,
- system-generated soft tasks and decks,
- fixed recurring tasks,
- one-off tasks,
- future scheduled decks,
- frozen decks/cards waiting for Agent2 review,
- proof-linked deck history.

The deck library can be surfaced inside `proof` as a todo/deck overview:

```text
proof
-> deck/todo overview
-> click a deck
-> see decomposed tasks, todo time, schedule state, proof state
```

This overview must not replace the active deck execution surface.

The proof/deck-library timeline should show:

- formatted recommended good line,
- formatted harden line when present,
- current tension color,
- reason for tension change,
- recommended execution time,
- whether the item is optional, recommended, or now pushed into deck execution.

Progressive disclosure rule:

```text
The proof/deck-library overview may keep these fields in data, but it must not show everything at once.
The first glance should show only the task/deck title, tension color, current state, and one next recommended action.
Good line, harden line, reason, recommended execution time, latest safe time, and detailed schedule/proof context should appear after expand/click or inside the timeline detail.
```

## Agent Responsibilities

### Agent1: Input Organizing

Agent1 produces a deck once from a user input.

It judges:

- whether an input is a fixed recurring task,
- whether an input is a one-off task,
- whether the task should remain in the deck library after completion,
- whether a口头 task can be cleared after completion,
- whether the generated deck lifecycle needs user confirmation.

After generating the deck, Agent1 must show the user enough lifecycle information to understand:

```text
fixed task vs one-off task
kept in library vs cleared after completion
soft vs hard / deadline-sensitive
```

Confirmation rule:

```text
High-confidence lifecycle classification may proceed automatically.
Low-confidence or high-risk lifecycle decisions require user confirmation.
High-risk includes fixed courses, recurring tasks, and any one-off task that will be cleared after completion.
```

### Agent2: Time Guardian

Agent2 reviews deck-library items over time.

It can:

- pull tomorrow's scheduled deck from the library,
- notify the user when a task becomes relevant,
- push soft tasks when time is available,
- turn soft tasks into repeated nudges after the good line,
- push hardened soft tasks into the deck execution flow without interruptive popups,
- insert frozen items back into the active schedule,
- update schedule times based on facts,
- protect hard locks.

Agent2 cannot:

- remove the user's guaranteed reminder,
- silently move hard locks,
- delete fixed tasks,
- treat soft-task deferral as moral failure.
- pop an interruptive card solely because a soft task hardened.

### Agent3: Action Review And System Soft Tasks

Agent3 creates system-generated tasks.

Current rule:

```text
All system-generated tasks are soft tasks by default.
```

Source rule:

```text
Agent3-generated soft tasks must be grounded in existing proof/profile evidence.
It should not create proactive system tasks from nothing or from broad assumptions about the user.
Cold-start generic system tasks are not allowed unless a later PM decision explicitly enables them.
```

Agent3 may use proof/profile evidence to create:

- review tasks,
- recovery tasks,
- preparation tasks,
- continuation tasks,
- reflection or proof-summary tasks.

Agent3 does not directly push tasks. It creates candidates in the deck library; Agent2 decides when to surface them.

## Frozen Tasks

Freezing does not delete a task from the deck library.

Freezing means:

```text
task/deck remains in library
-> re-enters Agent2 review
-> Agent2 may reinsert it into schedule
-> Agent2 may change time based on facts
```

Frozen tasks should keep context and proof history.

## Fixed Tasks And One-Off Tasks

Fixed tasks:

- remain in the deck library,
- may recur,
- should not be cleared after one completion,
- include examples such as class attendance or regular check-ins.

One-off tasks:

- may be cleared after completion,
- often come from口头 input or single-use requests,
- still need proof records,
- must be distinguished from fixed tasks by Agent1.

The user should see this classification after deck generation.

## Completion Lines

Soft-task completion and hard-task minimum completion are separate concepts.

Example:

```text
去上课
```

This is not a soft task if it refers to a real class. It is a fixed/hard task.

However, it can still have:

- minimum completion: 到教室 / 打卡,
- standard completion: attend class with materials,
- continuation cards: open book, mark chapter, write one note.

The minimum completion can satisfy a baseline goal without deleting the fixed task from the library.

## Proof Rules

Soft tasks enter proof.

Proof should record:

- soft task suggested,
- soft task deferred,
- soft task frozen,
- soft task hardened,
- soft task completed,
- fixed task completed,
- one-off task cleared,
- Agent2 rescheduled frozen task,
- Agent3 generated soft task.

Proof language should avoid failure framing before a hard deadline or hardening event.

## Current Decisions

- Soft tasks are deadline-flexible, not deadline-free.
- Agent2 determines at setup/scheduling time whether a task is soft, recommended, deadline-sensitive, or hard.
- Agent2 may auto-rearrange soft tasks as long as hard locks are protected.
- Soft task reminders start gentle.
- Agent3 may generate system soft tasks.
- Agent3-generated system soft tasks must be grounded in proof/profile evidence.
- Agent1 only produces the deck once from the input.
- User initialization is effectively profile selection.
- The deck library is deck data, not a template catalog.
- User-facing task tension is distinguished primarily by color.
- The recommended good line and harden line are visible as formatted proof/deck-library timeline information.
- When a soft task crosses the harden line, it should be pushed into the deck execution flow, but it must not create an interruptive popup.
- Proof timeline should show why the soft task became stronger, its color upgrade, and recommended execution time.
- Agent1 uses high-confidence automatic lifecycle classification; fixed courses, recurring tasks, and completion-clearing decisions require confirmation when confidence is low or risk is high.
- After a soft task hardens, Agent2 may push it at most 2 times per day. If the user still does not respond, it should switch to review/freeze instead of escalating indefinitely.
- Proof/deck-library overview can retain rich fields, but the UI must progressively disclose them instead of showing all fields at once.

## Open Questions

No soft-task/deck-library PM questions are currently blocking architecture execution.

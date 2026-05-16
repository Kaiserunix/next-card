# Backend Extension Boundaries

Next Card MVP intentionally uses mock AI, mock OCR, and local state. Real services should connect only after the local deck loop is stable, tested, and still follows the product contract in `AGENTS.md`.

This document defines where future OCR, OpenAI planning, backend persistence, reminders, calendar sync, and proof export should attach. It is a boundary map, not permission to wire real services in the MVP.

## OpenAI / Planning API

Current substitute:

```text
lib/mock-ai.ts
```

Current mock functions:

```text
mockAnalyzeInput(input)
mockGeneratePlanOptions(analysis)
mockRegeneratePlanOptions(input, previousOptions)
mockGenerateTaskFlow(selectedPlan)
mockGenerateDeckFromPlan(selectedPlan, taskFlow)
mockGenerateTimePlanForCard(card, selectedPlan)
mockUpdateCardUrgency(card, now)
mockRescheduleFrozenCard(card, taskFlow)
mockGenerateProofSummary(proofs)
```

Future real planning services must return the existing domain shapes from `lib/types.ts`:

```text
AnalysisResult
PlanOption[]
TaskFlowState
TaskDeck
```

Rules:

- UI components must not depend on raw provider responses.
- Service adapters should normalize provider output before it reaches the Zustand store.
- The planning flow must still understand first, decompose second, and offer exactly three plan choices third.
- Generated cards must remain decomposed action tasks, not broad goals.
- The MVP must keep `lib/mock-ai.ts` as the local fallback until real service behavior is stable.

## OCR API

Current substitute:

```text
InputsState.imageSchedule
InputsState.parsedText
```

Future OCR should fill only these local domain fields:

```text
UploadedImage.parsedTimetable
inputs.parsedText
```

Rules:

- OCR should behave like an input parser, not a new primary product mode.
- Do not add a fourth top tab for OCR.
- Keep uploaded image metadata inside `InputsState.imageSchedule`.
- Merge parsed OCR text into the same planning path used by text and mock attachments.
- Preserve `SourceType` values so proof records can still explain whether the source was `text`, `attachment`, `image`, or `mixed`.

## Backend Persistence

Current substitute:

```text
localStorage key: `next-card-mvp`
```

Future backend synchronization may store:

```text
inputs
taskFlow
deck
proofs
```

Rules:

- Do not treat pure UI state as backend-authoritative state.
- `mode`, expanded panels, prompts, animations, and transient drag state should remain client-owned unless a later product decision says otherwise.
- Backend sync should preserve deck cards, frozen queues, reward cards, proof records, summary documents, and task-flow progress.
- Existing localStorage persistence should remain a graceful offline fallback.
- Store migrations must keep historical deck and proof records readable.

## Reminder / Calendar

Current substitute:

```text
deadlineAt
suggestedStartAt
rescheduleQueue
```

Future native or backend reminder systems should derive reminders from card time fields:

```text
TaskCard.deadlineAt
TaskCard.suggestedStartAt
DeckState.rescheduleQueue
```

Rules:

- Reminder and calendar integrations should not create a new primary app mode.
- A calendar entry should point back to a card or deck, not replace the deck execution flow.
- Frozen-card scheduling should use `mockRescheduleFrozenCard` behavior as the domain contract until a real scheduler exists.
- Reminder status should be recorded in proof only as behavior evidence, not as a separate task source of truth.

## Proof Export

Current substitute:

```text
proofs.records
proofs.summaryDocument
```

Future export targets may include:

```text
Markdown
PDF
Cloud proof archive
```

Rules:

- Export should read from `ProofRecord[]` and `summaryDocument`, not scrape the rendered proof UI.
- Proof exports must preserve completed, in-progress, frozen, rewarded, and needs-review states.
- Burn, freeze, crack, weathering, actual time, and reschedule events should stay visible as evidence.
- PDF or archive export should be an output action inside `proof`, not a fourth mode.

## Non-Goals For The MVP

Do not wire any of these in the current MVP package:

```text
real OCR
real OpenAI API
database persistence
login or auth
calendar sync
push notifications
native reminder bridge
cloud proof archive
```

The correct next step for each area is to build an adapter around the existing domain types, then add tests that prove the UI and store still consume the same local contract.

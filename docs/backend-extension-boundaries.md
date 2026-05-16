# Backend Extension Boundaries

This document defines where real backend services are allowed to plug into
Next Card. The MVP intentionally keeps everything client-side: mock AI in
`lib/mock-ai.ts`, persistence in `localStorage`. Anyone who wires up real
OpenAI, OCR, persistence, reminders, or calendar must land their work
**only** at the seams listed here.

If your change crosses a seam not described below, treat it as a product
decision and revisit `AGENTS.md` first.

## Hard Rules

1. UI components must not import a real network client directly. They depend
   on the typed contracts in `lib/page-contracts.ts` and the data shapes in
   `lib/types.ts`.
2. The first screen stays the input composer. Real services do not get to add
   a new top-level mode (`input / deck / proof` is fixed).
3. Real services must return existing domain types. Do not introduce a
   parallel set of "API" types that diverge from `lib/types.ts`.
4. Persistence beyond `localStorage` must be additive, not replacing the
   in-app state. The store remains the single source of truth for runtime UI.

## Seam: Planning / OpenAI

Replaces:

```text
lib/mock-ai.ts
  mockAnalyzeInput
  mockGeneratePlanOptions
  mockRegeneratePlanOptions
  mockGenerateTaskFlow
  mockGenerateDeckFromPlan
  mockGenerateTimePlanForCard
  mockUpdateCardUrgency
  mockRescheduleFrozenCard
  mockGenerateProofSummary
```

A real planning API must return:

```text
AnalysisResult
PlanOption[]      // length must equal 3
TaskFlowState     // nodes.length <= 4
TaskDeck          // cards.length <= 6
```

Validation (recommended): wrap the response in a `validateAIOutput()` adapter
before storing it. Required checks:

- `PlanOption[]` length is exactly 3.
- `PlanOption.id` is `plan-1 | plan-2 | plan-3`.
- `PlanOption.style` is `urgent | balanced | gentle`.
- Every plan has 4 steps.
- `deadlineLabel`, `availableWindow`, `suggestedStart` non-empty.
- `urgencyStage` and `damageEffect` only use the enums in `lib/types.ts`.

If validation fails: log, fall back to the mock function, and surface a soft
notice in `proof.summaryDocument`. Do not crash the UI.

## Seam: OCR

Replaces nothing today. Today's input flow only uses mocked image parsing.

When a real OCR service is added:

- Fill `InputsState.imageSchedule.parsedTimetable` and the rolled-up
  `inputs.parsedText`. Do not introduce a separate "OCR result" page.
- Keep the upload UI in `components/input/InputComposer.tsx`. The composer is
  the only entry point for image input.

## Seam: Backend Persistence

Replaces:

```text
localStorage key: next-card-mvp
```

When a real backend syncs state:

- Sync these slices only:
  - `inputs`
  - `taskFlow`
  - `deck`
  - `proofs`
- Do not sync `mode` (UI-only).
- Do not sync `analysisStatus` (UI-only, fragile across refresh).
- The store keeps writing to `localStorage` for offline availability; the
  remote sync is additive.

## Seam: Reminders / Calendar

Replaces nothing today. The card model already exposes:

```text
TaskCard.deadlineAt
TaskCard.suggestedStartAt
DeckState.rescheduleQueue
```

A native reminder bridge or external calendar sync should:

- Read `deadlineAt` and `suggestedStartAt` from cards in
  `deck.decks[].cards`.
- Treat `rescheduleQueue` ids as candidates for a "resume later"
  notification.
- Never write back time fields directly. If the user reschedules in a
  calendar, the bridge should call `resumeFrozenCard(cardId)` with a fresh
  `suggestedStartAt`, not mutate the card from the outside.

## Seam: Proof Export

Replaces nothing today. `ProofDashboard` only renders.

When export is added:

- Read from `proofs.records` and `proofs.summaryDocument`.
- Implementations may produce Markdown, PDF, or remote archives.
- Export must be idempotent and read-only against the store.

## Recommended Order If You Are Adding A Real Backend

1. Wrap `lib/mock-ai.ts` so a planning service can be swapped in behind the
   same function signatures.
2. Add a thin sync layer (e.g. a Zustand middleware) that mirrors the
   persisted slices to the backend.
3. Bridge OCR through `addMockImageSchedule`'s replacement.
4. Bridge reminders/calendar last, after the deck loop is stable on a real
   device.

Until step 1 is solid, do not start step 2. Until the core mock loop is
"demo-stable" on Android WebView, do not start step 3 or 4.

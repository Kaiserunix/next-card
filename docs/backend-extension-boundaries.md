# Backend Extension Boundaries

Next Card now has a backend service layer for the core production behaviors: post-voice Plan Mode drafts, input/import review, priority scheduling experiments, freeze return, worker ticks, and pluggable backend ports.

This document defines where multimodal import parsing, AI planning, backend persistence, reminders, calendar sync, and proof export should attach without rewriting the frontend.

## Implemented Core Backend

```text
app/api/backend/health
app/api/backend/plan-mode
app/api/backend/import/review
app/api/backend/schedule/plan
app/api/backend/freeze/return
app/api/backend/worker/tick
app/api/backend/push/public-key
app/api/backend/push/subscriptions
app/api/backend/push/send
app/api/backend/calendar/events

lib/server/backend-ports.ts
lib/server/plan-mode/types.ts
lib/server/plan-mode/request-validation.ts
lib/server/plan-mode/plan-mode-service.ts
lib/server/plan-mode/plan-mode-repository.ts
lib/server/plan-mode/deterministic-plan-provider.ts
lib/server/plan-mode/plan-output-validator.ts
lib/server/backend-services.ts
lib/server/schedule-planner.ts
lib/server/freeze-return-agent.ts
lib/server/import-coverage.ts
lib/server/plan-mode-service.ts
lib/server/backend-worker.ts
lib/server/queue-repository.ts
lib/server/provider-dispatch.ts
lib/server/agent-runtime.ts
lib/server/providers/mimo-ai-provider.ts
lib/server/providers/web-push-notification-provider.ts
lib/server/providers/push-subscription-repository.ts
lib/server/providers/ics-calendar-provider.ts
```

Rules:

- UI components should call API/backend clients, not provider SDKs.
- Backend route handlers stay thin; business rules belong in `lib/server/*`.
- Keep `PriorityVector`, `QueueAction`, and `TimeLock` tests passing before changing scheduling behavior.
- Hard notebook/user/calendar time locks are never silently overwritten.
- Large timetable/notification/multi-goal imports must create a review gate before cards enter the queue.

## OpenAI / Planning API

Current post-voice planning backend:

```text
POST /api/backend/plan-mode
PlanCompilerHandoff -> PlanModeDraft
.nextcard-data/plan-mode-drafts.json
```

Responsibilities:

- receive a verified `PlanCompilerHandoff`,
- require `confirmedTranscriptId` for `voice-confirmed` requests,
- produce a `PlanModeDraft` with exactly A/B/C options,
- validate provider output before saving,
- persist drafts for regeneration and future deck commit reference,
- fallback to `deterministic-local` if a configured provider fails or returns invalid output.

Non-responsibilities:

- never commit deck,
- never write proof,
- never create reminders,
- never schedule cards,
- never select or default to option A.

Future deck commit should use a separate request shape such as:

```text
planModeDraftId + selectedOptionId
```

Current local fallback:

```text
lib/mock-ai.ts
```

Current fallback functions:

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

Legacy/frontend planning services should normalize provider output into the existing domain shapes from `lib/types.ts`:

```text
AnalysisResult
PlanOption[]
TaskFlowState
TaskDeck
```

Rules:

- UI components must not import a real network client directly.
- Real services must return the existing domain types rather than introducing a parallel API-only model.
- UI components must not depend on raw provider responses.
- Service adapters should normalize provider output before it reaches the Zustand store.
- The planning flow must still understand first, decompose second, and offer exactly three plan choices third.
- Generated cards must remain decomposed action tasks, not broad goals.
- Keep `lib/mock-ai.ts` as the local fallback while real service behavior is stabilized.
- Any planner response should be validated before reaching the store: three plans, four steps per plan, non-empty time anchors, and enum-safe urgency/damage values.

## Multimodal Import API

Current backend entry:

```text
POST /api/backend/import/review
lib/server/import-coverage.ts
```

Current local fields:

```text
InputsState.imageSchedule
InputsState.parsedText
```

Future multimodal import parsing should fill only these local domain fields:

```text
UploadedImage.parsedTimetable
inputs.parsedText
```

Rules:

- Multimodal import parsing should behave like an input parser, not a new primary product mode.
- Do not add a fourth top tab for import parsing.
- Keep uploaded image metadata inside `InputsState.imageSchedule`.
- Merge parsed multimodal text into the same planning path used by text and mock attachments.
- Preserve `SourceType` values so proof records can still explain whether the source was `text`, `attachment`, `image`, or `mixed`.

## Backend Persistence

Current local fallback:

```text
localStorage key: `next-card-mvp`
```

Backend synchronization may store:

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

Current backend entries:

```text
POST /api/backend/schedule/plan
POST /api/backend/freeze/return
POST /api/backend/worker/tick
GET /api/backend/push/public-key
POST /api/backend/push/subscriptions
POST /api/backend/push/send
POST /api/backend/calendar/events
lib/server/schedule-planner.ts
lib/server/freeze-return-agent.ts
lib/server/backend-worker.ts
lib/server/providers/web-push-notification-provider.ts
lib/server/providers/ics-calendar-provider.ts
```

Current frontend fields:

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
- Frozen-card scheduling should use `FrozenTaskEntry` and `analyzeFrozenTaskReturn` so return timing is re-evaluated against the current global queue.
- Reminder status should be recorded in proof only as behavior evidence, not as a separate task source of truth.
- Web Push uses VAPID env vars and stored browser `PushSubscription` JSON.
- Calendar sync currently writes real `.ics` files; Google/Outlook OAuth is intentionally outside this slice.

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

## Remaining Provider Work

The core backend is present, but these production adapters are still outstanding:

```text
login or auth
native reminder bridge
cloud proof archive
production database migration
provider-grade multimodal file handling and storage
provider-grade AI planner normalization
Google/Microsoft calendar OAuth provider
```

The correct next step for each area is to build an adapter around `lib/server/backend-ports.ts`, then add tests that prove the UI and store still consume the same local contract.

## Recommended Backend Order

1. Replace `JsonFileQueueRepository` with a production database-backed `QueueRepository`.
2. Add native/mobile provider bridges only after the Web Push and ICS providers are validated on device.
3. Normalize real Mimo outputs into `ImportReviewResult`, `PlanModeTurnResult`, and existing deck/task types.
4. Add auth/session ownership before multi-user data leaves the local machine.

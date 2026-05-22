# Next Card Post-Voice Plan Mode Backend Design

Date: 2026-05-21
Status: PM/backend design decided by Codex

## Core Decision

Post-Voice Plan Mode Backend starts after the user confirms a voice/manual-dictation transcript and the input layer has produced a `PlanCompilerHandoff`.

The backend route is:

```text
POST /api/backend/plan-mode
```

It produces a `PlanModeDraft` with explicit A/B/C options.

It must not commit a deck.
It must not schedule cards.
It must not write proof.
It must not create reminders.
It must not default to option A.

This is the bridge:

```text
confirmed transcript
-> input-layer fact confirmation
-> PlanCompilerHandoff
-> POST /api/backend/plan-mode
-> PlanModeDraft with A/B/C
-> user selects one option
-> later Deck Commit Service
```

## Why Codex Decides This

This is not a remaining product-direction question.

The PM contract is already fixed:

- explicit Plan Mode is mandatory,
- voice confirmation cannot directly create cards,
- A/B/C options are required before deck commit,
- deck/proof backend writes are not part of the voice slice,
- hidden agents/model workers may only output drafts/proposals.

So the correct backend boundary is:

```text
Plan Mode backend owns draft generation.
Deck Commit owns committed deck state.
Time Guardian owns scheduling.
Proof Ledger owns proof.
```

## Scope

### In Scope

- `POST /api/backend/plan-mode`
- `PlanModeRequest`
- `PlanModeDraft`
- `PlanOption` A/B/C schema
- regeneration using the same source handoff
- provider port for AI planning
- deterministic fallback planner
- validation that output is exactly three options
- route tests and service tests

### Out Of Scope

- deck commit route
- card runtime state
- proof writes
- Time Guardian scheduling
- reminder creation
- streaming plan generation
- frontend redesign
- external provider SDK inside UI code

## Upstream Contract

The route should accept `PlanCompilerHandoff` as the primary input.

Current upstream type already exists in:

```text
lib/server/input-layer/types.ts
```

Required properties:

```ts
type PlanCompilerHandoff = {
  id: string;
  verifiedInputBundleId: string;
  userFacingSummary: string;
  constraints: string[];
  assumptions: string[];
  missingButNonBlocking: string[];
  sourceType: RawInputSourceType;
  mustGenerateABC: true;
};
```

Route rule:

```text
Do not accept raw unconfirmed voice transcript as plan-mode authority.
```

The request may carry a confirmed transcript id for traceability, but the planning authority is the verified handoff.

## API Shape

### Request

```ts
type PlanModeRequest = {
  requestId: string;
  anonymousDeviceId?: string;
  userId?: string;
  operation: "generate" | "regenerate";
  source: "voice-confirmed" | "manual-dictation" | "text-confirmed" | "multimodal-confirmed";
  planCompilerHandoff: PlanCompilerHandoff;
  confirmedTranscriptId?: string;
  previousPlanModeDraftId?: string;
  regenerateHint?: "try-again" | "more-urgent" | "more-gentle" | "more-detailed";
  clientContext: {
    now: string;
    timezone: string;
    locale: "zh-CN" | "en" | "mixed" | "auto";
  };
};
```

Validation:

- `requestId` is required.
- `operation="regenerate"` requires `previousPlanModeDraftId`.
- `planCompilerHandoff.mustGenerateABC` must be `true`.
- `planCompilerHandoff.verifiedInputBundleId` must exist.
- `userFacingSummary` must not be empty.
- `clientContext.timezone` is required.
- If `source="voice-confirmed"`, `confirmedTranscriptId` should be present.

### Response

```ts
type PlanModeResponse = {
  draft: PlanModeDraft;
};
```

### Error Response

```ts
type PlanModeErrorResponse = {
  error:
    | "PLAN_MODE_NOT_READY"
    | "INVALID_PLAN_MODE_REQUEST"
    | "PROVIDER_FAILED"
    | "PLAN_OUTPUT_INVALID";
  message: string;
  recoverable: boolean;
};
```

## Draft Schema

```ts
type PlanModeDraft = {
  id: string;
  requestId: string;
  operation: "generate" | "regenerate";
  source: PlanModeRequest["source"];
  planCompilerHandoffId: string;
  verifiedInputBundleId: string;
  confirmedTranscriptId?: string;
  previousPlanModeDraftId?: string;
  status: "options-ready" | "needs-more-facts" | "blocked";
  goalUnderstanding: string;
  keyConstraints: string[];
  decomposition: PlanStageDraft[];
  timeStrategy: string[];
  options: [PlanOptionDraft, PlanOptionDraft, PlanOptionDraft];
  assumptions: string[];
  missingButNonBlocking: string[];
  provider: "deterministic-local" | "mimo" | "openai-compatible" | "unknown";
  modelRunId?: string;
  createdAt: string;
  writes: {
    deckCommitted: false;
    proofWritten: false;
    remindersCreated: false;
    scheduleQueued: false;
  };
};

type PlanStageDraft = {
  id: string;
  title: string;
  purpose: string;
  sourceConstraintRefs: string[];
};

type PlanOptionDraft = {
  id: "plan-a" | "plan-b" | "plan-c";
  mode: "A" | "B" | "C";
  style: "urgent" | "balanced" | "gentle";
  title: string;
  objective: string;
  summary: string;
  estimatedTotalMinutes: number;
  riskLevel: "low" | "medium" | "high";
  tradeoffs: string[];
  cardDrafts: ActionCardDraft[];
};

type ActionCardDraft = {
  id: string;
  title: string;
  action: string;
  estimatedMinutes: number;
  objectiveLevel: "progress" | "standard" | "baseline";
  timingIntent: "start-now" | "scheduled-window" | "before-deadline" | "soft-optional";
  sourceStageId: string;
};
```

## Option Semantics

The backend must produce exactly three options:

```text
A = urgent / rapid
B = balanced
C = gentle
```

Rules:

- A/B/C must be different execution strategies, not wording variants.
- All options must be executable.
- Card drafts must be decomposed actions, not broad goals.
- The response must not mark any option as selected.
- The response must not imply option A is default.
- Regeneration must preserve the original `PlanCompilerHandoff`.

## Provider Strategy

Plan Mode uses a provider port:

```ts
interface PlanModeProviderPort {
  readonly provider: "deterministic-local" | "mimo" | "openai-compatible";
  generatePlanModeDraft(input: PlanModeProviderInput): Promise<PlanModeProviderOutput>;
}
```

First implementation requirement:

```text
Always include deterministic-local fallback.
```

Provider order:

1. Use configured real provider if available and valid.
2. Validate provider output.
3. If provider fails or returns invalid shape, fall back to deterministic-local.
4. Mark `draft.provider` with the provider that produced the accepted draft.

Mimo/OpenAI-compatible providers are adapter slots. UI must never import provider SDKs.

## Storage Decision

Post-Voice Plan Mode Backend may persist plan drafts in a lightweight repository:

```text
PlanModeDraftRepository
```

Default implementation:

```text
local JSON under .nextcard-data/plan-mode-drafts.json
```

Purpose:

- allow regeneration traceability,
- allow later deck commit to reference selected draft and option,
- keep draft authority separate from committed deck authority.

The repository owns drafts only.

It does not own:

- committed decks,
- active cards,
- reminders,
- proof records,
- profile snapshots.

## Service Split

Recommended files:

```text
lib/server/plan-mode/types.ts
lib/server/plan-mode/request-validation.ts
lib/server/plan-mode/plan-mode-service.ts
lib/server/plan-mode/plan-mode-repository.ts
lib/server/plan-mode/deterministic-plan-provider.ts
lib/server/plan-mode/plan-output-validator.ts
app/api/backend/plan-mode/route.ts
```

Service flow:

```text
route
-> validate request
-> PlanModeService
-> provider port
-> output validator
-> deterministic fallback if needed
-> draft repository save
-> response
```

## Regeneration

`operation="regenerate"`:

- requires `previousPlanModeDraftId`,
- uses the same `PlanCompilerHandoff`,
- can use `regenerateHint`,
- creates a new `PlanModeDraft.id`,
- keeps `previousPlanModeDraftId`,
- must still output exactly A/B/C,
- must not mutate the previous draft.

Regeneration is not deck commit.

## Readiness And Missing Facts

The input layer should prevent not-ready handoffs from reaching plan-mode.

If plan-mode receives insufficient handoff data:

```text
return PLAN_MODE_NOT_READY
```

Plan Mode should not invent:

- event object,
- task type,
- deadline,
- hard lock,
- location that affects arrival.

Minor missing fields may remain in `missingButNonBlocking`.

## Downstream Contract

The future Deck Commit Service should receive:

```ts
type DeckCommitRequest = {
  planModeDraftId: string;
  selectedOptionId: "plan-a" | "plan-b" | "plan-c";
  userEdits?: unknown;
};
```

This design does not implement deck commit.

It reserves the boundary so implementation agents do not put commit logic inside plan-mode.

## Safety Rules

- No raw unconfirmed transcript enters plan-mode as authority.
- No A/B/C skip.
- No default selected plan.
- No deck commit.
- No proof write.
- No reminder creation.
- No Time Guardian queue action.
- No provider SDK in UI.
- No broad task cards such as `学习数学` or `完成作业`.
- No accepting provider output unless exactly three options validate.

## Acceptance Criteria

1. `POST /api/backend/plan-mode` rejects requests without `PlanCompilerHandoff`.
2. Voice source requests require `confirmedTranscriptId`.
3. Valid requests return `PlanModeDraft.status="options-ready"`.
4. Returned options are exactly A/B/C.
5. No option is selected by the backend.
6. Each option contains decomposed action card drafts.
7. Regeneration creates a new draft and links the previous draft.
8. Provider invalid output falls back to deterministic-local.
9. Draft response explicitly reports no deck/proof/reminder/schedule writes.
10. Tests prove plan-mode cannot commit deck, append proof, create reminder, or enqueue Time Guardian actions.

## PM Log Summary

Decision:

```text
Codex decides the Post-Voice Plan Mode Backend direction.
Pro may review schema/risk later but does not decide the product direction.
```

Final backend boundary:

```text
PlanCompilerHandoff -> PlanModeDraft(A/B/C) -> user selection -> future Deck Commit Service.
```

# Next Card Deck Commit / Proof Ledger Authority Boundary

Date: 2026-05-21
Status: P0 backend boundary decided by Codex

## Core Decision

Next Card uses a deterministic commit boundary:

```text
PlanModeDraft
-> user selects A/B/C
-> Deck Commit Service writes committed deck + initial cards
-> Deck Commit emits verified proof requests / outbox events
-> Proof Ledger validates and appends proof events
-> Time Guardian receives committed deck/card refs for scheduling
```

The chosen architecture is:

```text
Deck Commit owns committed deck and initial card state.
Proof Ledger owns append-only proof events.
Deck Commit may request proof, but it must not write Proof Ledger directly.
```

This preserves the product requirement that proof shows visible evidence while preventing deck creation, model planning, scheduling, profile, or reminder services from fabricating proof.

## Brainstormed Options

### Option A: Deck Commit writes deck and proof in one service

Deck Commit would create the committed deck, create cards, and append a `deck_committed` proof event in the same service.

Pros:

- Simple mental model.
- Easy MVP route implementation.
- Proof timeline can show deck creation immediately.

Cons:

- Deck Commit becomes two authorities at once.
- Later card runtime could copy the pattern and write proof directly.
- Failed proof validation may corrupt the semantic boundary.
- Makes it easier for planner output to become visible proof too early.

Rejected for P0.

### Option B: Full event sourcing for everything

All state changes would be events. Decks, cards, proof, reminders, and profile would be projections over one event stream.

Pros:

- Strong audit story.
- Rollback and replay are clean.
- Proof and runtime can share an append-only substrate.

Cons:

- Too heavy for current Web MVP.
- Forces every backend worker to understand global event semantics.
- Slows first implementation of deck commit and proof.
- More infrastructure than the current local JSON / adapter-backed phase needs.

Rejected for P0, can be reconsidered later if persistence becomes a real backend database.

### Option C: Command services plus proof request outbox

Deck Commit writes only deck/card authority stores. It emits typed proof requests and audit outbox records. Proof Ledger is the only component that can append proof after validating event source, actor, idempotency, and event semantics.

Pros:

- Preserves separate authority.
- Keeps MVP simple.
- Gives proof visible timeline material.
- Supports retry if proof append fails after deck commit.
- Matches existing Time Guardian pattern: services can request proof, but cannot append it.

Cons:

- Requires one extra request/outbox type.
- Requires idempotency rules on both deck commit and proof append.

Selected for P0.

## Non-Negotiable Boundary

### Deck Commit Service may write

- committed deck records,
- initial card runtime records,
- deck commit audit records,
- proof event request outbox records,
- Time Guardian handoff records.

### Deck Commit Service must not write

- Proof Ledger events directly,
- reminder jobs,
- notification delivery audit,
- profile snapshots,
- policy snapshots,
- TimeLock / deadline authority stores,
- unchosen A/B/C option state.

### Proof Ledger may write

- append-only proof events,
- proof correction events,
- proof summary source records,
- proof projection cache if needed.

### Proof Ledger must not write

- deck/card state,
- reminders,
- schedules,
- TimeLocks,
- deadlines,
- profile,
- policy,
- PlanModeDraft.

## Runtime Flow

```text
POST /api/backend/deck/commit
  input: CommitDeckRequest
  validate PlanModeDraft + selected plan
  compile committed deck/cards
  persist DeckStore + CardRuntimeStore initial state
  persist DeckCommitAudit
  enqueue ProofEventRequest(deck_committed)
  return CommitDeckResult + TimeGuardianDeckHandoff

ProofEventRequest processor / explicit service call
  input: ProofEventRequest
  validate source service and event semantics
  append ProofEvent
  update proof projection if configured
```

The first implementation can run the request processor synchronously inside a deterministic backend orchestrator, but the write boundary stays the same:

```text
Deck Commit produces proof request.
Proof Ledger appends proof event.
```

## Commit Request Contract

```ts
type CommitDeckRequest = {
  requestId: string;
  idempotencyKey: string;
  userId?: string;
  anonymousDeviceId?: string;
  planModeDraftId: string;
  selectedPlanId: "plan-a" | "plan-b" | "plan-c";
  userEdits?: {
    deckTitle?: string;
    cardTitleOverrides?: Record<string, string>;
    disabledCardDraftIds?: string[];
  };
  clientContext: {
    now: string;
    timezone: string;
    locale: "zh-CN" | "en" | "mixed" | "auto";
  };
};
```

Validation rules:

- `PlanModeDraft.status` must be `options-ready`.
- selected option must exist in that exact draft.
- only one option can be committed.
- unchosen options must not create cards, reminders, proof, or Time Guardian actions.
- a draft can be committed once unless a new request has the same `idempotencyKey`, in which case the existing result is returned.
- user edits may rename or disable non-required card drafts, but cannot remove baseline/standard goal integrity.
- user edits cannot create hidden TimeLocks or deadlines.

## Committed Deck Contract

```ts
type CommittedDeck = {
  id: string;
  userId?: string;
  anonymousDeviceId?: string;
  planModeDraftId: string;
  selectedPlanId: "plan-a" | "plan-b" | "plan-c";
  title: string;
  status: "active" | "frozen" | "completed" | "needs-review" | "archived";
  sourceVerifiedInputBundleId: string;
  sourceHandoffId: string;
  goalContractId: string;
  cardIds: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
};

type CommittedCard = {
  id: string;
  deckId: string;
  sourceCardDraftId: string;
  chosenPlanId: "plan-a" | "plan-b" | "plan-c";
  title: string;
  action: string;
  state: "queued" | "active" | "completed" | "frozen" | "cancelled" | "needs-review";
  tension: "hard" | "deadline-sensitive" | "recommended" | "soft" | "unknown";
  estimatedMinutes: number;
  deadlineAt?: string;
  preferredStartAt?: string;
  sourceConstraintRefs: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
};
```

P0 should keep committed deck/card structures close to existing Time Guardian refs:

```ts
type CommittedDeckRef = {
  deckId: string;
  chosenPlanId: string;
  title: string;
};

type CommittedCardRef = {
  cardId: string;
  deckId: string;
  chosenPlanId: string;
  title: string;
  tension: TaskTension;
  estimatedMinutes: number;
  deadlineAt?: string;
  hardLockRefs: string[];
  preferredStartAt?: string;
};
```

## Proof Event Request Contract

Services outside Proof Ledger do not append proof directly. They create validated requests:

```ts
type ProofEventRequest = {
  id: string;
  idempotencyKey: string;
  sourceService:
    | "deck-commit"
    | "card-runtime"
    | "time-guardian"
    | "notification-adapter"
    | "summary-service";
  sourceActionId: string;
  actor: "user" | "system";
  eventType: ProofEventType;
  userId?: string;
  anonymousDeviceId?: string;
  deckId?: string;
  cardId?: string;
  reminderId?: string;
  occurredAt: string;
  summary: string;
  metadata?: Record<string, unknown>;
};
```

Allowed P0 proof event types:

```ts
type ProofEventType =
  | "deck_committed"
  | "card_started"
  | "card_completed"
  | "card_frozen"
  | "freeze_undone"
  | "burn_started"
  | "burn_resolved"
  | "card_deferred"
  | "reward_earned"
  | "reminder_delivered"
  | "deadline_warning"
  | "soft_task_hardened"
  | "summary_accepted";
```

Deck Commit may only request:

```ts
"deck_committed"
```

Card Runtime may request:

```ts
"card_started"
"card_completed"
"card_frozen"
"freeze_undone"
"burn_started"
"burn_resolved"
"card_deferred"
"reward_earned"
```

Time Guardian may request:

```ts
"deadline_warning"
"soft_task_hardened"
```

Notification Adapter may request:

```ts
"reminder_delivered"
```

Summary Service may request:

```ts
"summary_accepted"
```

## Proof Event Contract

```ts
type ProofEvent = {
  id: string;
  requestId: string;
  idempotencyKey: string;
  eventType: ProofEventType;
  actor: "user" | "system";
  sourceService: ProofEventRequest["sourceService"];
  sourceActionId: string;
  userId?: string;
  anonymousDeviceId?: string;
  deckId?: string;
  cardId?: string;
  reminderId?: string;
  occurredAt: string;
  appendedAt: string;
  summary: string;
  metadata?: Record<string, unknown>;
  correctionOfEventId?: string;
};
```

Proof Ledger is append-only. It does not delete or overwrite events. Corrections are represented as new events or as `correctionOfEventId`.

## Proof Validation Rules

Proof Ledger must reject:

- raw unconfirmed voice transcript events,
- rejected transcript events,
- unconfirmed OCR/PDF/notification extraction events,
- PlanModeDraft output as proof,
- unchosen A/B/C option events,
- `reminder_failed` as user ignored,
- failed notification delivery as user behavior,
- model-generated "completed" claims without a Card Runtime action,
- profile-generated events,
- morality or diagnosis metadata,
- proof text containing shame labels such as `懒`, `低自律`, `拖延症`, `执行力差`, `人格评分`.

Proof Ledger may accept:

- user-selected deck commit as `deck_committed`,
- verified card runtime transitions,
- verified notification delivery,
- Time Guardian deadline/soft-task hardening facts,
- user-accepted summaries.

## Deck Commit And Proof Semantics

`deck_committed` means:

```text
The user chose one Plan Mode option and a deck was created.
```

It does not mean:

```text
The user completed work.
The user succeeded.
The user failed.
The user is disciplined.
```

This event can appear in the proof/deck timeline because it is a visible product event, but it must be rendered neutrally.

Recommended copy:

```text
已从方案 B 生成卡组：物理预习报告。
```

Forbidden copy:

```text
你终于开始行动了。
你的执行力提升了。
你又拖到现在才建卡组。
```

## Idempotency

Deck Commit idempotency:

```text
idempotencyKey = user scope + planModeDraftId + selectedPlanId + requestId
```

Proof Ledger idempotency:

```text
idempotencyKey = sourceService + sourceActionId + eventType
```

Rules:

- repeating the same deck commit returns the existing committed deck.
- repeating the same proof request returns the existing proof event.
- committing the same draft with a different selected plan must be rejected unless a future explicit "recommit/rebuild" flow exists.
- appending proof for a missing deck/card is rejected unless the event is a standalone summary event with explicit source.

## Error Handling

Deck Commit errors:

```ts
type CommitDeckError =
  | "PLAN_DRAFT_NOT_FOUND"
  | "PLAN_DRAFT_NOT_READY"
  | "SELECTED_PLAN_NOT_FOUND"
  | "DRAFT_ALREADY_COMMITTED"
  | "INVALID_USER_EDIT"
  | "GOAL_INTEGRITY_VIOLATION"
  | "DECK_COMMIT_FAILED";
```

Proof Ledger errors:

```ts
type ProofAppendError =
  | "INVALID_PROOF_REQUEST"
  | "UNAUTHORIZED_PROOF_SOURCE"
  | "PROOF_EVENT_FORBIDDEN"
  | "PROOF_TARGET_NOT_FOUND"
  | "PROOF_IDEMPOTENCY_CONFLICT"
  | "PROOF_APPEND_FAILED";
```

If Deck Commit succeeds but Proof Ledger append fails:

- deck remains committed,
- proof request remains in outbox as `pending` or `failed-retryable`,
- user execution is not blocked,
- a backend audit warning is recorded,
- retry can append the neutral `deck_committed` proof later.

## API Boundary

Recommended P0 route:

```text
POST /api/backend/deck/commit
```

It returns:

```ts
type CommitDeckResponse = {
  deck: CommittedDeck;
  cards: CommittedCard[];
  proofRequests: ProofEventRequest[];
  timeGuardianHandoff: {
    committedDeck: CommittedDeckRef;
    committedCards: CommittedCardRef[];
    policySnapshotId?: string;
  };
};
```

Recommended internal Proof Ledger interface:

```ts
appendProofEvent(request: ProofEventRequest): Promise<ProofEvent>
listProofEvents(scope: ProofScope, window?: ProofWindow): Promise<ProofEvent[]>
buildProofProjection(events: ProofEvent[]): ProofProjection
```

No public generic "write any proof event" route should be exposed in P0. Proof writes should go through trusted backend services.

## Test Requirements

P0 tests must prove:

1. selected `plan-b` commits only `plan-b` cards.
2. unchosen A/C options do not create deck/card/proof/time-guardian refs.
3. repeating the same commit request is idempotent.
4. same draft with different selected plan is rejected after commit.
5. Deck Commit produces proof request but does not append Proof Ledger directly.
6. Proof Ledger accepts `deck_committed` only from `deck-commit`.
7. Proof Ledger rejects PlanModeDraft output as proof.
8. Proof Ledger rejects raw transcript / unconfirmed OCR as proof.
9. Proof Ledger rejects reminder delivery failure as user behavior.
10. Proof Ledger rejects shame/diagnosis language.
11. Card completion proof can only come from Card Runtime.
12. Time Guardian can request `deadline_warning`, not card completion.
13. Proof corrections append a new event rather than editing old events.
14. Commit success + proof append failure leaves retryable outbox state.

## P0 Implementation Packages

If this boundary is split into execution docs, use these packages:

1. A: shared contracts and fixtures
2. B: Deck Commit validator and idempotency
3. C: DeckStore / CardRuntimeStore local JSON repositories
4. D: Deck Commit compiler service
5. E: Proof Ledger contracts, append-only repository, and validator
6. F: Proof request outbox and retry semantics
7. G: Deck commit API route and trusted proof append orchestration
8. H: red-team tests and boundary skill draft

## Current Non-Goals

- no public arbitrary proof-write route,
- no full event-sourcing rewrite,
- no database migration,
- no real system calendar write,
- no external notification delivery implementation,
- no profile update from deck commit,
- no proof scoring,
- no UI redesign,
- no deck recommit/rebuild flow.

## Acceptance Decision

The P0 backend authority rule is:

```text
Deck Commit can create the deck.
Card Runtime can change card state.
Time Guardian can validate and request schedule/proof facts.
Notification Adapter can prove delivery.
Proof Ledger alone can append proof.
Profile can only read proof later.
```

That boundary is strict enough for the core product and light enough for the current implementation phase.

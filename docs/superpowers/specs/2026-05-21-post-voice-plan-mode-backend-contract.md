# Post-Voice Plan Mode Backend Contract

Date: 2026-05-21
Status: implementation contract

`POST /api/backend/plan-mode` starts only after the input layer has produced a verified `PlanCompilerHandoff`.

The route produces a `PlanModeDraft` with exactly three explicit options:

```text
A / urgent
B / balanced
C / gentle
```

This backend does not choose a plan, commit a deck, write proof, create reminders, or enqueue Time Guardian schedule actions.

## Authority Input

The authority input is:

```text
PlanCompilerHandoff
```

Raw transcript text, normalized transcript text, raw input IDs, and unconfirmed voice content may appear only as trace metadata. They cannot replace the handoff.

Voice-confirmed requests must include `confirmedTranscriptId`.

## Draft Boundary

Every accepted draft must include:

```ts
writes: {
  deckCommitted: false;
  proofWritten: false;
  remindersCreated: false;
  scheduleQueued: false;
}
```

These flags are boundary sentinels. A validator must reject any provider or service output that flips them.

## Future Boundary

Deck commit remains a later service:

```ts
type DeckCommitRequestStub = {
  planModeDraftId: string;
  selectedOptionId: "plan-a" | "plan-b" | "plan-c";
  userEdits?: unknown;
};
```

Plan Mode may persist drafts for traceability and later commit reference, but it is not the deck authority store.

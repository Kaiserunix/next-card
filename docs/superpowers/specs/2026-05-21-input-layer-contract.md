# Next Card Input Layer Contract

Date: 2026-05-21
Status: execution contract

The input organizing layer is a controlled service boundary. It may produce candidates, review requests, verified input bundles, and Plan Compiler handoff data. It must not directly write committed deck state, card runtime state, reminder jobs, proof records, profile snapshots, or hard-lock authority stores.

## Allowed Output Stages

```text
RawInput
-> InputExtractionResult
-> FactConfirmationRequest
-> VerifiedInputBundle
-> PlanCompilerHandoff
```

`PlanCompilerHandoff.mustGenerateABC` is always `true`; the next layer must still run explicit A/B/C Plan Mode.

## Contract Ownership

The TypeScript source of truth lives in:

```text
lib/server/input-layer/types.ts
```

The fixture baseline lives in:

```text
tests/fixtures/input-layer/*.json
tests/server/input-layer/input-layer-fixtures.test.ts
```

## Review Rules

Small voice, manual-dictation, and text inputs can use a light confirmation card. Large or high-risk sources such as timetable images, PDF/Word requirements, notification messages, mixed multi-goal inputs, relative dates, low-confidence times, prompt-like document text, and deadline or hard-lock candidates require strict review or blocking.

Evidence explains why the system made an interpretation. It is not proof that the interpretation is correct.

## Forbidden Direct Outputs

The input layer must not emit these as live state:

```text
committedDeck
cardState
proofRecord
reminderJob
profileSnapshot
```

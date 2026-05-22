# 2026-05-22 Post-P0 Backend Dogfood Report

## Result

Post-P0 backend dogfood hardening is complete for the planned backend-only slice.

The tester path now has a lightweight CLI entry that can run:

```text
import -> confirm -> A/B/C -> card action -> proof timeline
```

without rebuilding `/test-platform` or adding a display-heavy web platform.

## Changed Files

- `lib/server/proof-ledger/types.ts`
- `lib/server/proof-ledger/proof-timeline-projection.ts`
- `tests/server/proof-ledger/proof-timeline-projection.test.ts`
- `tests/api/backend/proof/timeline-route.test.ts`
- `lib/server/import-review/types.ts`
- `lib/server/import-review/import-review-service.ts`
- `tests/server/import-review/import-review-service.test.ts`
- `tests/api/backend/import/import-route-document.test.ts`
- `lib/server/time-guardian/queue-action-validator.ts`
- `lib/server/card-runtime/card-runtime-service.ts`
- `tests/server/time-guardian/queue-action-validator.test.ts`
- `tests/server/card-runtime/card-runtime-service.test.ts`
- `scripts/backend-chain-smoke.mjs`
- `tests/scripts/backend-chain-smoke.test.ts`
- `scripts/backend-dogfood.mjs`
- `tests/scripts/backend-dogfood.test.ts`
- `package.json`
- `README.md`
- `docs/real-mimo-test-service.md`
- `docs/superpowers/specs/2026-05-22-p0-usable-backend-closure-report.md`
- `docs/superpowers/specs/2026-05-22-p0-second-backend-gap-review.md`

## Boundary Fixes

- Reminder proof timeline entries now stay at `reminder_created` and display `提醒已记录`; they no longer imply external delivery.
- Import provider usage is derived from the actual extraction path:
  - text/manual/voice/notification text: `manual`
  - DOCX/TXT text extraction success: `document-text used:true`
  - PDF text fallback: `document-text used:false reason:document_text_unavailable`
  - image direct mock chain: `mock`
  - route-backed chain: `route` in CLI output
- `freeze-card` queue actions now pass through `validateQueueAction()` before Card Runtime returns them. Failed validation returns a recoverable user-review queue action and does not write frozen state or proof.
- `backend:chain` direct mode prints `multimodal provider: mock`; route mode prints `multimodal provider: route`.
- `backend:dogfood` prints review facts, plan options, selected option, runtime action states, proof timeline, and report path.

## Verification

Full gates:

```text
pnpm test
98 files / 556 tests passed.

pnpm typecheck
passed.

pnpm lint
passed.

pnpm build
passed. Build included /api/backend/card/action, /api/backend/deck/commit, /api/backend/import, /api/backend/import/confirm, /api/backend/plan-mode, /api/backend/proof/timeline, /api/backend/sandbox/run, and /api/backend/voice/* routes.
```

Focused checks:

```text
pnpm test tests/server/proof-ledger tests/api/backend/proof
3 files / 10 tests passed.

pnpm test tests/server/import-review tests/api/backend/import
5 files / 15 tests passed.

pnpm test tests/server/card-runtime tests/server/time-guardian/queue-action-validator.test.ts
3 files / 19 tests passed.

pnpm test tests/scripts/backend-chain-smoke.test.ts tests/scripts/backend-dogfood.test.ts
2 files / 2 tests passed.
```

Smoke outputs:

```text
pnpm backend:chain -- --case text-assignment --selected-option plan-b
multimodal provider: mock
import review: light
selected option: plan-b
card runtime actions: active,completed
proof timeline entries: deck_committed,card_started,card_completed

pnpm backend:chain -- --case crowded-timeline --selected-option plan-b
multimodal provider: mock
import review: light
queue actions: insert-schedule-event,insert-schedule-event,insert-schedule-event,defer-card
card runtime actions: deferred
proof timeline entries: deck_committed,card_deferred

pnpm backend:chain -- --case strict-image-confirmed --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --selected-option plan-b
multimodal provider: mock
import review: strict
selected option: plan-b
card runtime actions: completed
proof timeline entries: deck_committed,card_completed

pnpm backend:dogfood -- --text "今晚八点前交英语作文" --selected-option plan-b --actions start,complete
DOGFOOD_PROVIDER mock
IMPORT_REVIEW strict
FACTS event:交英语作文 | deadline:今晚八点前
PLAN_OPTIONS plan-a,plan-b,plan-c
SELECTED plan-b
CARD_ACTIONS active,completed
PROOF_TIMELINE deck_committed,card_started,card_completed

pnpm real:mimo -- --mode text --limit 1
OK text-course-hardlock 12504ms model=mimo-v2.5-pro parsed=true sufficiency=enough options=3

pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
OK image-001-66aa4560bbb1fd0251f0ac99 30340ms model=mimo-v2.5 parsed=true sourceKind=courseSchedule needsStrictReview=true events=11 times=11 eventTimes=11 standaloneTimes=0 locations=2 warnings=3 sentBytes=105535 resized=false
```

## Runtime Artifacts

Smoke reports were written under `.nextcard-data/`.

Git check:

```text
git status --short -- .nextcard-data
<empty>

git status --short --ignored -- .nextcard-data
!! .nextcard-data/
```

`.nextcard-data` remains ignored and is not committed.

## Remaining Not Done

- Production database.
- External notification delivery and delivery audit.
- Calendar sync.
- OCR PDF and PDF table reconstruction.
- Streaming ASR / streaming Plan Mode.
- Full frontend dogfood UI.
- Removing the existing `MODULE_TYPELESS_PACKAGE_JSON` warning from `pnpm real:mimo`; it is non-blocking.

## Next Recommendation

Use `pnpm backend:dogfood` to run 10-20 realistic tester cases before adding UI wiring. Prioritize timetable images, group notifications, DOCX assignment notices, prompt-injection documents, crowded timelines, and hard-lock conflicts.

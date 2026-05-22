# 2026-05-22 Backend MiMo Acceptance Report

## Scope

This report covers packages D/E/F from `2026-05-22-backend-mimo-completion-execution-index.md`:

- D: Deck Commit / Proof Ledger minimum authority-write closure.
- E: Backend Orchestrator sandbox chain.
- F: CLI summary/export, boundary redteam, and acceptance docs.

## Implemented

- `POST /api/backend/deck/commit`
  - commits exactly one selected Plan Mode option,
  - creates only cards from that selected option,
  - rejects duplicate commits,
  - queues proof through proof outbox,
  - appends `deck_committed` through Proof Ledger.

- `POST /api/backend/sandbox/run`
  - runs sandbox-only text input through Import Review, Plan Mode, Deck Commit, Time Guardian, and Proof Ledger,
  - stops strict image/import review before Plan Mode or deck commit,
  - requires explicit `selectedOptionId`,
  - schedules only the selected option.

- `pnpm real:mimo`
  - supports `--summarize latest|DIR`,
  - supports `--export-fixtures latest|DIR`,
  - writes sanitized exported fixtures without token, raw content, or data URL.

## Automated Verification

Package-specific checks:

```powershell
pnpm test tests/server/deck-commit tests/server/proof-ledger tests/api/backend/deck
pnpm test tests/server/backend-orchestrator tests/api/backend/sandbox
pnpm test tests/scripts/real-mimo-test-service.test.ts tests/server/backend-boundary-redteam.test.ts
```

Expected: all pass.

Latest local result:

```text
31 files / 103 tests passed for the D/E/F scoped package set.
tests/server/stress/agent1-agent2-stress-corpus.test.ts: 109 tests passed.
```

Full closure checks:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Latest full result:

```text
pnpm test: 83 files / 503 tests passed.
pnpm typecheck: passed.
pnpm lint: passed.
pnpm build: passed, including /api/backend/deck/commit and /api/backend/sandbox/run.
```

## Real Smoke Commands

Text:

```powershell
pnpm real:mimo -- --mode text --limit 1
```

Latest result:

```text
OK text-course-hardlock
semanticSufficiency=needs-more-facts
options=3
```

Image:

```powershell
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

Latest result:

```text
OK image-001-66aa4560bbb1fd0251f0ac99
sourceKind=courseSchedule
needsStrictReview=true
events=11
times=11
locations=2
```

Small image batch:

```powershell
pnpm real:mimo -- --mode image --image-dir "C:\Users\qwerf\.codex\generated_images\019e4957-65a1-7460-b2ae-a705d832703d" --limit 5 --delay-ms 1500 --timeout-ms 180000
```

Latest result:

```text
ok=5 failed=0 skipped=0
timeout=0 nonJson=0 schemaInvalid=0
totals events=13 times=18 locations=7
sourceKinds={"courseSchedule":1,"assignmentNotice":4}
```

## Not Done

- No production database.
- No frontend UI wiring for deck commit.
- No Card Runtime completion route.
- No external notification or calendar delivery.
- No default commit of option A.
- No `.nextcard-data` runtime artifact committed.

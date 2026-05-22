# 2026-05-22 P0 Usable Backend Closure Report

## Current State

- Branch: `codex/backend-only-runtime-20260522`
- Base HEAD while report was written: `8dd1710`
- Worktree state: P0 closure changes are local/uncommitted.
- Runtime artifacts: `.nextcard-data/` is ignored and must not be committed.

## Implemented Routes

```text
POST /api/backend/import
POST /api/backend/import/confirm
POST /api/backend/plan-mode
POST /api/backend/deck/commit
POST /api/backend/card/action
GET  /api/backend/proof/timeline
POST /api/backend/sandbox/run
POST /api/backend/voice/*
```

## Implemented Services

- `ImportReviewService` now creates pending confirmation sessions for non-blocked review reports.
- `ImportConfirmationService` confirms, corrects, or rejects review sessions and emits only `VerifiedInputBundle` / `PlanCompilerHandoff`.
- `extractDocumentText()` supports TXT and minimal DOCX body text extraction; PDF returns recoverable `document_text_unavailable` fallback.
- `CardRuntimeService` owns `start`, `complete`, `freeze`, `burn_start`, `burn_complete`, `defer`, and `resume`.
- `ProofTimelineProjection` reads ledger events into neutral user-visible timeline entries.
- `BackendSandboxRunService` accepts `timeLocks`, `availableWindows`, `confirmation`, `cardActions`, and `notificationCapability`.
- `pnpm backend:chain` runs sandbox chain cases without a dev server.

## P0 Closure Scope

Done:

- Strict review confirmation continuation.
- Selected A/B/C option deck commit remains explicit.
- Card Runtime is the only accepted source of `card_completed` proof.
- Freeze preserves committed cards and returns Time Guardian recovery/requeue action.
- Burn records pressure feedback without punishment copy.
- Proof Timeline is read-only.
- Sandbox chain can run import review, confirmation, Plan Mode, deck commit, Time Guardian, Card Runtime, Proof Ledger, and timeline projection.
- TXT/DOCX server text extraction exists; PDF fallback is explicit and recoverable.

Still intentionally not done:

- Production database.
- External notification delivery.
- Calendar sync.
- Full frontend UI wiring for the new backend routes.
- OCR PDF or table reconstruction.
- Streaming ASR / streaming Plan Mode.

## Verification

Package checks:

```powershell
pnpm test tests/server/import-review tests/api/backend/import tests/server/input-layer/document-text-extractor.test.ts
pnpm test tests/server/card-runtime tests/api/backend/card tests/server/proof-ledger
pnpm test tests/server/proof-ledger tests/api/backend/proof tests/server/card-runtime tests/api/backend/card
pnpm test tests/server/backend-orchestrator tests/api/backend/sandbox tests/scripts/backend-chain-smoke.test.ts
pnpm test tests/server/p0-backend-boundary-redteam.test.ts
```

Latest results:

```text
Import/document package: 6 files / 16 tests passed.
Card Runtime package: 4 files / 11 tests passed.
Proof Timeline package: 6 files / 16 tests passed.
Sandbox/CLI package: 5 files / 11 tests passed.
P0 redteam: 1 file / 9 tests passed.
Cross-package input/plan/time-guardian gate: 46 files / 147 tests passed.
```

Full gates:

```text
pnpm test: 96 files / 541 tests passed.
pnpm typecheck: passed.
pnpm lint: passed.
pnpm build: passed.
```

Build confirmed these backend routes:

```text
/api/backend/card/action
/api/backend/deck/commit
/api/backend/import
/api/backend/import/confirm
/api/backend/plan-mode
/api/backend/proof/timeline
/api/backend/sandbox/run
/api/backend/voice/*
```

## Real MiMo Smoke

Text smoke:

```powershell
pnpm real:mimo -- --mode text --limit 1
```

Latest result:

```text
OK text-course-hardlock 9175ms model=mimo-v2.5-pro parsed=true sufficiency=enough options=3
REPORT .nextcard-data/mimo-test-runs/2026-05-22T09-25-51-566Z-938672b9/report.json
```

Image smoke:

```powershell
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

Latest result:

```text
OK image-001-66aa4560bbb1fd0251f0ac99 13507ms model=mimo-v2.5 parsed=true sourceKind=courseSchedule needsStrictReview=true events=10 times=10 eventTimes=10 standaloneTimes=0 locations=2 warnings=3 sentBytes=105535 resized=false
REPORT .nextcard-data/mimo-test-runs/2026-05-22T09-25-51-574Z-9458a9fc/report.json
```

## Backend Chain Smoke

`pnpm backend:chain` direct mode proves deterministic backend orchestration with `multimodal provider: mock`. It must be read alongside `pnpm real:mimo` for real MiMo text/image extraction. Route mode can combine a running Next server with real provider config and prints `multimodal provider: route`.

Strict image confirmed:

```text
multimodal provider: mock
import review: strict
fact confirmation required: true
selected option: plan-b
committed deck/cards: deck_86de84ce98eb64ef / 3
queue actions: insert-schedule-event,insert-schedule-event,insert-schedule-event
card runtime actions: completed
proof timeline entries: deck_committed,card_completed
```

Crowded timeline:

```text
multimodal provider: mock
import review: light
fact confirmation required: true
selected option: plan-b
committed deck/cards: deck_46aed03593684b01 / 3
queue actions: insert-schedule-event,insert-schedule-event,insert-schedule-event,defer-card
card runtime actions: deferred
proof timeline entries: deck_committed,card_deferred
```

## Handoff Prompt

```text
在 C:\Users\qwerf\Desktop\nextcard 继续 P0 后端闭环后的下一阶段。
先看 docs/superpowers/specs/2026-05-22-p0-usable-backend-closure-report.md 和 docs/superpowers/specs/2026-05-22-p0-redteam-cases.md。
当前后端已支持 strict review 确认续跑、Card Runtime、Proof Timeline、sandbox chain、TXT/DOCX 最小抽取。
不要重建网页平台，不要提交 .nextcard-data，不要暴露 MIMO_API_KEY / Bearer token / data URL。
下一步优先选择：前端最小接入确认/卡片动作/Proof Timeline，或把 PDF 真实文本抽取接入小依赖并补测试。
```

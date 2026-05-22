# Post-P0 Backend Dogfood Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining Post-P0 backend boundary issues and add a practical dogfood entry so a tester can run `import -> confirm -> A/B/C -> card action -> proof timeline` without rebuilding a display-heavy web platform.

**Architecture:** Keep the current hidden-runtime contract. This plan only tightens semantics, reporting, and a lightweight CLI dogfood path; it must not add production database, external notification delivery, calendar sync, or full frontend redesign.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Vitest, Node CLI, local JSON stores under `.nextcard-data`.

---

## Source Of Truth

Read these first:

- `AGENTS.md`
- `docs/superpowers/specs/2026-05-22-p0-usable-backend-closure-report.md`
- `docs/superpowers/specs/2026-05-22-p0-second-backend-gap-review.md`
- `docs/superpowers/specs/2026-05-22-p0-redteam-cases.md`

Current branch/worktree:

- Branch: `codex/backend-only-runtime-20260522`
- P0 closure commit: `760b041 feat: complete p0 backend closure`
- This plan starts from the committed P0 closure and targets the remaining dogfood/hardening gaps.
- Do not revert or discard existing local changes.

## Success Criteria

- Reminder timeline semantics no longer claim delivery when only a reminder record exists.
- Backend chain CLI clearly marks mock vs real-provider paths.
- DOCX/PDF import reports provider usage based on the actual extraction path.
- Card Runtime freeze queue action passes the same queue action validation discipline as other Time Guardian actions.
- A practical dogfood CLI can run a small real-ish chain and print review facts, selected option, runtime actions, and proof timeline.
- Full verification passes:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm backend:chain -- --case text-assignment --selected-option plan-b
pnpm backend:chain -- --case crowded-timeline --selected-option plan-b
pnpm backend:chain -- --case strict-image-confirmed --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --selected-option plan-b
pnpm real:mimo -- --mode text --limit 1
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

## Task 1: Fix Proof Timeline Reminder Semantics

**Files:**

- Modify: `lib/server/proof-ledger/types.ts`
- Modify: `lib/server/proof-ledger/proof-timeline-projection.ts`
- Test: `tests/server/proof-ledger/proof-timeline-projection.test.ts`
- Test: `tests/api/backend/proof/timeline-route.test.ts`

- [ ] **Step 1: Add a failing projection test**

Add a test that appends a `reminder_created` proof event and expects the timeline entry type to be `reminder_created` or `reminder_recorded`, not `reminder_delivered`.

Expected assertion shape:

```ts
expect(result.entries.at(-1)).toMatchObject({
  type: "reminder_created",
  title: "提醒已记录",
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

```powershell
pnpm test tests/server/proof-ledger/proof-timeline-projection.test.ts
```

Expected before fix: FAIL because current projection maps `reminder_created` to `reminder_delivered`.

- [ ] **Step 3: Update timeline types**

Change `ProofTimelineEntry["type"]` to include `reminder_created` and remove the false delivery implication unless a true delivery audit event exists.

Implementation rule:

```ts
if (type === "reminder_created") return "reminder_created";
```

Do not call it delivered.

- [ ] **Step 4: Run timeline and route tests**

```powershell
pnpm test tests/server/proof-ledger tests/api/backend/proof
```

Expected: PASS.

## Task 2: Make Import Provider Usage Truthful

**Files:**

- Modify: `lib/server/import-review/types.ts`
- Modify: `lib/server/import-review/import-review-service.ts`
- Test: `tests/server/import-review/import-review-service.test.ts`
- Test: `tests/api/backend/import/import-route-document.test.ts`

- [ ] **Step 1: Add provider usage cases**

Add tests for:

- DOCX successful local extraction returns provider `document-text`, `used: true`.
- PDF recoverable fallback returns provider `document-text`, `used: false`, or a similarly explicit non-MiMo result.
- Image extraction still reports `mimo` or `mock` according to the actual extractor.

Expected test shape:

```ts
expect(report.providerUsage).toMatchObject({
  provider: "document-text",
  used: true,
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

```powershell
pnpm test tests/server/import-review/import-review-service.test.ts tests/api/backend/import/import-route-document.test.ts
```

Expected before fix: FAIL for DOCX/PDF provider usage.

- [ ] **Step 3: Extend provider usage type**

Allow:

```ts
provider: "mimo" | "mock" | "manual" | "document-text";
```

If adding fields, prefer explicit names:

```ts
recoverable?: boolean;
reason?: string;
```

- [ ] **Step 4: Compute provider usage from actual path**

Do not infer from source type alone. In `ImportReviewService.review()`, derive provider usage after document extraction and extraction path are known.

Rules:

- text / manual-dictation / voice / notification text path -> `manual`
- DOCX/TXT local extraction success -> `document-text`, `used: true`
- PDF text unavailable fallback -> `document-text`, `used: false`, `reason: "document_text_unavailable"`
- image real extractor -> `mimo`
- image mock extractor -> `mock`

- [ ] **Step 5: Run focused tests**

```powershell
pnpm test tests/server/import-review tests/api/backend/import
```

Expected: PASS.

## Task 3: Validate Freeze Queue Actions

**Files:**

- Modify: `lib/server/time-guardian/queue-action-validator.ts` if freeze validation is missing.
- Modify: `lib/server/card-runtime/card-runtime-service.ts`
- Test: `tests/server/time-guardian/queue-action-validator.test.ts`
- Test: `tests/server/card-runtime/card-runtime-service.test.ts`

- [ ] **Step 1: Add or confirm freeze queue action validator coverage**

Test that a `freeze-card` queue action is allowed only when:

- `chosenPlanId` matches expected selected plan.
- `deckId` and `cardId` exist.
- action does not move a hard lock.

Expected assertion:

```ts
expect(validation.allowed).toBe(true);
```

- [ ] **Step 2: Run validator tests**

```powershell
pnpm test tests/server/time-guardian/queue-action-validator.test.ts
```

Expected before fix if missing: FAIL or no coverage. Add coverage either way.

- [ ] **Step 3: Call `validateQueueAction()` for freeze**

In `CardRuntimeService`, validate `createFreezeAction()` before returning it. If validation fails, reject the runtime action with a recoverable error or user-review queue action.

Do not let freeze silently bypass Time Guardian queue action rules.

- [ ] **Step 4: Run card runtime tests**

```powershell
pnpm test tests/server/card-runtime tests/server/time-guardian/queue-action-validator.test.ts
```

Expected: PASS.

## Task 4: Make Backend Chain CLI Provider-Clear

**Files:**

- Modify: `scripts/backend-chain-smoke.mjs`
- Modify: `docs/real-mimo-test-service.md`
- Modify: `docs/superpowers/specs/2026-05-22-p0-usable-backend-closure-report.md`
- Test: `tests/scripts/backend-chain-smoke.test.ts`

- [ ] **Step 1: Add CLI output assertion**

Update the CLI test to require provider output:

```ts
expect(stdout).toContain("multimodal provider:");
expect(stdout).toContain("mock");
```

- [ ] **Step 2: Print provider mode**

In direct mode, print:

```text
multimodal provider: mock
```

If `--route-url` is used, print:

```text
multimodal provider: route
```

- [ ] **Step 3: Document the split**

In docs, state:

- `pnpm backend:chain` direct mode proves deterministic backend orchestration.
- `pnpm real:mimo` proves real MiMo text/image extraction.
- Route mode can combine a running Next server with real provider config.

- [ ] **Step 4: Run focused tests and CLI smoke**

```powershell
pnpm test tests/scripts/backend-chain-smoke.test.ts
pnpm backend:chain -- --case strict-image-confirmed --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --selected-option plan-b
```

Expected: PASS and output explicitly says mock or route.

## Task 5: Add A Practical Dogfood CLI Entry

**Files:**

- Create or Modify: `scripts/backend-dogfood.mjs`
- Modify: `package.json`
- Create: `tests/scripts/backend-dogfood.test.ts`
- Modify: `README.md`

Prefer creating `scripts/backend-dogfood.mjs` if `backend-chain-smoke.mjs` would become too crowded.

- [ ] **Step 1: Add script**

Add to `package.json`:

```json
"backend:dogfood": "node scripts/backend-dogfood.mjs"
```

- [ ] **Step 2: Implement non-interactive dogfood mode first**

Minimum command:

```powershell
pnpm backend:dogfood -- --text "今晚八点前交英语作文" --selected-option plan-b --actions start,complete
```

Minimum output:

```text
IMPORT_REVIEW light|strict|blocked
FACTS ...
PLAN_OPTIONS plan-a,plan-b,plan-c
SELECTED plan-b
CARD_ACTIONS ...
PROOF_TIMELINE ...
REPORT <path>
```

- [ ] **Step 3: Add file/image option**

Support:

```powershell
pnpm backend:dogfood -- --source image --file "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --confirm --selected-option plan-b --actions complete
```

Direct mode may use mock unless `--route-url` is provided. Print provider clearly.

- [ ] **Step 4: Add tests**

Test only direct deterministic mode:

```powershell
pnpm test tests/scripts/backend-dogfood.test.ts
```

Assertions:

- stdout contains `IMPORT_REVIEW`
- stdout contains `PLAN_OPTIONS`
- stdout contains `PROOF_TIMELINE`
- report JSON has `committedDeck.selectedOptionId === "plan-b"`

- [ ] **Step 5: Document dogfood usage**

README should explain this is a developer/backend dogfood entry, not the final product UI.

## Task 6: Final Verification And Handoff

**Files:**

- Modify: `docs/superpowers/specs/2026-05-22-p0-second-backend-gap-review.md`
- Create or Modify: `docs/superpowers/specs/2026-05-22-post-p0-dogfood-report.md`

- [ ] **Step 1: Run full gates**

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

- [ ] **Step 2: Run backend chain smoke**

```powershell
pnpm backend:chain -- --case text-assignment --selected-option plan-b
pnpm backend:chain -- --case crowded-timeline --selected-option plan-b
pnpm backend:chain -- --case strict-image-confirmed --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --selected-option plan-b
```

- [ ] **Step 3: Run real MiMo smoke**

```powershell
pnpm real:mimo -- --mode text --limit 1
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

- [ ] **Step 4: Run dogfood smoke**

```powershell
pnpm backend:dogfood -- --text "今晚八点前交英语作文" --selected-option plan-b --actions start,complete
```

- [ ] **Step 5: Write final report**

Report must include:

- changed files
- test results
- smoke outputs
- remaining not-done items
- explicit statement that `.nextcard-data` is not committed
- next recommendation

## Current Launch Prompt

Use this in the next conversation:

```text
在 C:\Users\qwerf\Desktop\nextcard 继续 Post-P0 后端 dogfood 收口。
先读：
1. AGENTS.md
2. docs/superpowers/specs/2026-05-22-p0-usable-backend-closure-report.md
3. docs/superpowers/specs/2026-05-22-p0-second-backend-gap-review.md
4. docs/superpowers/plans/2026-05-22-post-p0-backend-dogfood-plan.md

当前 P0 后端链路已通过 test/typecheck/lint/build，并且 backend:chain 与真实 MiMo text/image smoke 已跑通。目标不是做网页平台，也不是生产化数据库。

请按计划执行：
1. 修 Proof Timeline 的 reminder_created/reminder_delivered 语义。
2. 修 DOCX/PDF providerUsage，让报告按实际 extraction path 上报。
3. 让 Card Runtime freeze action 走 Time Guardian queue action validator。
4. 让 backend:chain 明确打印 mock/route/real provider，避免把 mock image chain 误认为真实 MiMo。
5. 增加一个极简 backend:dogfood CLI，能跑 import -> confirm -> A/B/C -> card action -> proof timeline。
6. 最后跑 pnpm test / typecheck / lint / build，以及 backend:chain、backend:dogfood、最小 real:mimo text/image smoke。

注意：
- 不要重建 /test-platform 网页平台。
- 不要提交 .nextcard-data。
- 不要暴露 MIMO_API_KEY、Bearer token 或 data URL。
- 不要默认选择方案 A。
- 不要让模型输出直接写 deck/proof/reminder/profile。
```

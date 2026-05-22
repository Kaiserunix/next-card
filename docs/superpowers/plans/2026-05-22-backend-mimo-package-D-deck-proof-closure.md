# D：Deck Commit / Proof Ledger 最小闭环包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 实现 Plan Mode 选择方案后的最小权威写入闭环：deck/card commit 与 proof append-only。

**Architecture:** Deck Commit 负责校验选择、编译 committed deck/cards、写 commit audit 和 proof outbox；Proof Ledger 是唯一 append-only writer。两个服务通过 request/outbox 交互，不互相越权。

**Tech Stack:** TypeScript, Vitest, Next.js route handlers, local JSON repositories under `.nextcard-data`.

---

## 目标

落地后端权威写入最小闭环：用户选择 A/B/C 一个方案后，commit deck/card，并生成 proof request/outbox；Proof Ledger 负责 append-only 写入。此包聚合 2026-05-21 的 deck/proof A-H 计划为一条 P0 最小路径。

## 文件

- Create: `lib/server/deck-commit/types.ts`
- Create: `lib/server/deck-commit/commit-validator.ts`
- Create: `lib/server/deck-commit/deck-compiler.ts`
- Create: `lib/server/deck-commit/commit-service.ts`
- Create: `lib/server/deck-commit/json-repositories.ts`
- Create: `lib/server/proof-ledger/types.ts`
- Create: `lib/server/proof-ledger/proof-event-validator.ts`
- Create: `lib/server/proof-ledger/proof-ledger-repository.ts`
- Create: `lib/server/proof-ledger/proof-outbox-service.ts`
- Create: `app/api/backend/deck/commit/route.ts`
- Test: `tests/server/deck-commit/*.test.ts`
- Test: `tests/server/proof-ledger/*.test.ts`
- Test: `tests/api/backend/deck/commit-route.test.ts`

## 最小闭环

```text
PlanModeDraft
-> CommitDeckRequest(selectedPlanId)
-> CommittedDeck + CommittedCard[]
-> ProofEventRequest(deck_committed)
-> ProofOutboxRecord
-> ProofLedger append
-> ProofTimeline projection
```

## 关键规则

- 只能 commit 用户选择的一个 option。
- 未选择 option 不创建 card。
- Deck Commit 不能直接 append proof。
- Proof Ledger 不能写 deck/card/reminder/profile。
- `deck_committed` 不表示完成，也不表示表现好坏。
- `card_completed` 只能来自 Card Runtime，P0 不伪造。

## 步骤

- [ ] 写合同和 fixture 测试。
- [ ] 实现 commit request validator。
- [ ] 实现 deck/card compiler。
- [ ] 实现 JSON repositories，写到 `.nextcard-data/decks.json`、`.nextcard-data/cards.json`、`.nextcard-data/proof-ledger.json`。
- [ ] 实现 proof event validator。
- [ ] 实现 proof outbox service。
- [ ] 实现 commit service。
- [ ] 实现 route。
- [ ] 写红队测试：未选择 A/B/C、重复 commit、羞辱性 proof、伪造 completed proof。

## 验收

```powershell
pnpm test tests/server/deck-commit tests/server/proof-ledger tests/api/backend/deck
pnpm typecheck
pnpm lint
pnpm build
```

## 不做

- 不做完整数据库。
- 不做 Card Runtime completion。
- 不做公开任意 proof write route。

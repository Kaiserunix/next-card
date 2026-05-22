# 任务包 A：共享合同与 Fixture 包

> **执行要求：** 本包只定义 Deck Commit / Proof Ledger 的共享类型、fixture 和合同测试。不要实现 API route、真实 repository、proof append 流程、Time Guardian 排程或 UI。

**目标：** 建立 `CommitDeckRequest`、`CommittedDeck`、`CommittedCard`、`ProofEventRequest`、`ProofEvent`、`ProofOutboxRecord`、`CommitDeckResponse`、`TimeGuardianDeckHandoff` 等稳定合同，后续任务包全部复用。

**优先级：** P0

**依赖：** 无。应最先执行。

## 涉及文件

```text
docs/superpowers/specs/2026-05-21-deck-commit-proof-ledger-boundary.md
lib/server/deck-commit/types.ts
lib/server/proof-ledger/types.ts
tests/server/deck-commit/deck-commit-fixtures.test.ts
tests/server/proof-ledger/proof-ledger-fixtures.test.ts
tests/fixtures/deck-commit/plan-b-ready-draft.json
tests/fixtures/deck-commit/plan-b-commit-request.json
tests/fixtures/deck-commit/already-committed-draft.json
tests/fixtures/deck-commit/invalid-user-edit-removes-required-card.json
tests/fixtures/proof-ledger/deck-committed-request.json
tests/fixtures/proof-ledger/card-completed-from-card-runtime.json
tests/fixtures/proof-ledger/rejected-raw-transcript-proof.json
tests/fixtures/proof-ledger/reminder-failed-not-user-behavior.json
tests/fixtures/proof-ledger/shame-language-proof.json
```

如果当前 repo 还没有 `lib/server/deck-commit/`、`lib/server/proof-ledger/`、`tests/server/deck-commit/` 或 `tests/server/proof-ledger/`，本包负责创建目录。

## 必须定义的核心类型

```ts
type PlanSelectionId = "plan-a" | "plan-b" | "plan-c";

type CommitDeckRequest = {
  requestId: string;
  idempotencyKey: string;
  userId?: string;
  anonymousDeviceId?: string;
  planModeDraftId: string;
  selectedPlanId: PlanSelectionId;
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

必须包含这些对象：

```text
CommittedDeck
CommittedCard
DeckCommitAudit
CommitDeckResponse
TimeGuardianDeckHandoff
ProofEventType
ProofEventRequest
ProofEvent
ProofOutboxRecord
ProofScope
ProofWindow
ProofProjection
```

## Proof event matrix

类型层面必须能表达这些 source/event 关系：

```text
deck-commit -> deck_committed
card-runtime -> card_started / card_completed / card_frozen / freeze_undone / burn_started / burn_resolved / card_deferred / reward_earned
time-guardian -> deadline_warning / soft_task_hardened
notification-adapter -> reminder_delivered
summary-service -> summary_accepted
```

不能把 `reminder_failed`、`profile_updated`、`plan_generated` 设计成 P0 proof event type。

## 必须准备的 fixtures

```text
plan-b-ready-draft.json
plan-b-commit-request.json
already-committed-draft.json
invalid-user-edit-removes-required-card.json
deck-committed-request.json
card-completed-from-card-runtime.json
rejected-raw-transcript-proof.json
reminder-failed-not-user-behavior.json
shame-language-proof.json
```

## 合同测试重点

- `CommitDeckRequest.selectedPlanId` 只能是 `plan-a`、`plan-b`、`plan-c`。
- `CommittedDeck.selectedPlanId` 必须和请求一致。
- `CommittedCard.chosenPlanId` 必须和 deck 一致。
- `ProofEventRequest.sourceService="deck-commit"` 只能配 `eventType="deck_committed"`。
- fixture 中不出现 generic proof write route。
- fixture 中不出现 profile、policy、reminder job 或 TimeLock 写入作为 Deck Commit 输出。

## 验收标准

- 类型层面能表达 `PlanModeDraft -> CommitDeckRequest -> CommittedDeck/CommittedCard`。
- 类型层面能表达 `ProofEventRequest -> ProofEvent`。
- 类型层面不能把 Deck Commit 输出表达成直接 proof append。
- 类型层面不能把 Proof Ledger 输出表达成 deck/card mutation。
- fixture 覆盖 plan-b happy path、重复提交、非法用户编辑、raw transcript proof 拒绝、失败提醒不算用户行为、羞辱文案拒绝。

## 验证命令

```powershell
pnpm test tests/server/deck-commit/deck-commit-fixtures.test.ts tests/server/proof-ledger/proof-ledger-fixtures.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/deck-commit/types.ts lib/server/proof-ledger/types.ts tests/server/deck-commit tests/server/proof-ledger tests/fixtures/deck-commit tests/fixtures/proof-ledger
git commit -m "feat: define deck commit and proof ledger contracts"
```

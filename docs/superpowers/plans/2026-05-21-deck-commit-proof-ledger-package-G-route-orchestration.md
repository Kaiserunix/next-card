# 任务包 G：Deck Commit API Route 与 Trusted Orchestration 包

> **执行要求：** 本包实现 `POST /api/backend/deck/commit` 的薄 route 和可信 backend orchestration。不要暴露 public generic proof write route，不要创建 reminder，不要 schedule cards。

**目标：** 让前端或后续 Plan Mode 流程可以提交用户选择的 A/B/C 方案，并得到 committed deck/cards、proof request 状态和 Time Guardian handoff。

**优先级：** P0

**依赖：** A、B、C、D、E、F。

## 涉及文件

```text
app/api/backend/deck/commit/route.ts
lib/server/deck-commit/commit-service.ts
lib/server/deck-commit/commit-response.ts
tests/api/backend/deck/commit-route.test.ts
tests/server/deck-commit/commit-service.test.ts
```

如果 `app/api/backend/deck/` 不存在，本包负责创建目录。

## Route 输入输出

输入：

```text
CommitDeckRequest
```

输出：

```text
CommitDeckResponse
```

错误：

```text
CommitDeckErrorResponse
```

## Orchestration 流程

```text
validate request
load PlanModeDraft
check idempotency / conflict
validate draft ready
compile committed deck/cards
save deck/cards
save commit audit
enqueue deck_committed proof request
try trusted Proof Ledger append
keep retryable outbox if append fails
return deck/cards/proof request status/timeGuardianHandoff
```

## 必须实现的 service 接口

```ts
commitDeck(request: CommitDeckRequest): Promise<CommitDeckResponse>
```

`CommitDeckResponse` 必须包含：

```text
deck
cards
proofRequests
proofOutboxRecords
timeGuardianHandoff
warnings
```

## Route 规则

- API route 保持薄，只做 JSON parsing、调用 service、格式化 response。
- route 不直接 import provider SDK。
- route 不直接 append proof。
- route 不创建 reminder。
- route 不 enqueue Time Guardian action。
- route 不允许 body 携带 arbitrary proof event。
- route 不允许 selectedPlanId 缺失时默认 `plan-a`。

## 测试重点

- happy path: commit `plan-b` 返回 committed deck/cards。
- response cards 全部 `chosenPlanId="plan-b"`。
- proof request 是 `deck_committed`，source 是 `deck-commit`。
- Proof Ledger append 成功时 outbox record 为 appended。
- Proof Ledger append 临时失败时 route 仍返回 committed deck，warnings 包含 retryable proof outbox。
- 同一 idempotency key 重复请求返回 existing result。
- 同 draft 改选 plan-c 被拒绝。
- request body 注入 arbitrary proof event 被拒绝。
- route 不存在公开 `POST /api/backend/proof/write-anything`。

## 验收标准

- route 可被 `tests/api/backend/deck/commit-route.test.ts` 调用。
- service 可在无外部 provider 情况下用 fixture 测试。
- Deck Commit 和 Proof Ledger 权威边界在测试中可见。
- 返回的 Time Guardian handoff 只包含 committed refs，不包含 queue action。

## 验证命令

```powershell
pnpm test tests/server/deck-commit/commit-service.test.ts tests/api/backend/deck/commit-route.test.ts
pnpm typecheck
pnpm lint
```

## 建议提交

```powershell
git add app/api/backend/deck/commit/route.ts lib/server/deck-commit/commit-service.ts lib/server/deck-commit/commit-response.ts tests/api/backend/deck/commit-route.test.ts tests/server/deck-commit/commit-service.test.ts
git commit -m "feat: add deck commit backend route"
```

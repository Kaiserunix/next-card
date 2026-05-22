# 任务包 F：Proof Request Outbox 与 Retry 包

> **执行要求：** 本包只实现 proof request outbox 的存储、状态机和 retry helper。不要生成 committed deck，不要实现 API route，不要绕过 Proof Ledger validator。

**目标：** 保证 Deck Commit 成功但 Proof Ledger append 暂时失败时，proof request 不丢失、不阻塞用户执行，并可由可信 backend flow 重试。

**优先级：** P0

**依赖：** A、E。

## 涉及文件

```text
lib/server/proof-ledger/proof-outbox-repository.ts
lib/server/proof-ledger/proof-outbox-service.ts
tests/server/proof-ledger/proof-outbox-repository.test.ts
tests/server/proof-ledger/proof-outbox-service.test.ts
```

P0 本地数据路径：

```text
.nextcard-data/proof-request-outbox.json
```

## Outbox 状态机

```text
pending
-> appended
-> failed-retryable
-> failed-blocked
```

含义：

- `pending`: 已创建 request，尚未 append。
- `appended`: Proof Ledger 已 append 对应 event。
- `failed-retryable`: 临时失败，可重试。
- `failed-blocked`: validator 永久拒绝，需要修复 source request。

## 必须实现的接口

```ts
enqueueProofRequest(request: ProofEventRequest): Promise<ProofOutboxRecord>
markProofRequestAppended(recordId: string, proofEventId: string): Promise<ProofOutboxRecord>
markProofRequestFailed(recordId: string, errorCode: string, retryable: boolean): Promise<ProofOutboxRecord>
listRetryableProofRequests(scope?: ProofScope): Promise<ProofOutboxRecord[]>
processProofOutboxRecord(record: ProofOutboxRecord, ledger: ProofLedgerPort): Promise<ProofOutboxRecord>
```

## 规则

- enqueue 使用 `ProofEventRequest.idempotencyKey` 去重。
- 已 `appended` 的 record 不能再次 append。
- `failed-blocked` 不自动重试。
- `failed-retryable` 可再次送入 Proof Ledger。
- outbox 只存 proof request 和 append 状态，不存 deck/card mutation。
- outbox failure 不回滚 committed deck。

## 测试重点

- enqueue 同一 request 返回同一 record。
- pending record 成功 append 后变成 appended。
- ledger 临时失败后变成 failed-retryable。
- validator 永久拒绝后变成 failed-blocked。
- failed-retryable 可再次处理。
- appended record 再处理不重复 append。
- deck commit success + proof append failure 保留 retryable outbox。

## 验收标准

- outbox service 只通过 Proof Ledger port append proof。
- outbox 不直接写 `.nextcard-data/proof-ledger.json`。
- outbox 不写 deck/card/reminder/schedule/profile。
- route/orchestrator 可以使用本包完成同步尝试和失败保留。

## 验证命令

```powershell
pnpm test tests/server/proof-ledger/proof-outbox-repository.test.ts tests/server/proof-ledger/proof-outbox-service.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/proof-ledger/proof-outbox-repository.ts lib/server/proof-ledger/proof-outbox-service.ts tests/server/proof-ledger/proof-outbox-repository.test.ts tests/server/proof-ledger/proof-outbox-service.test.ts
git commit -m "feat: add proof request outbox"
```

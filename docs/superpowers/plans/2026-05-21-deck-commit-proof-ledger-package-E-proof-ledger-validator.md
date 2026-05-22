# 任务包 E：Proof Ledger 合同、Append-only Repository 与 Validator 包

> **执行要求：** 本包实现 Proof Ledger 自身的 validator、append-only repository 和 projection helper。不要写 deck/card state，不要接 API route，不要让外部服务绕过 validator。

**目标：** 让 Proof Ledger 成为唯一 proof append 权威，并拒绝未确认输入、模型草案、失败提醒、未授权 source/event、羞辱文案和诊断性 metadata。

**优先级：** P0

**依赖：** A。

## 涉及文件

```text
lib/server/proof-ledger/proof-event-validator.ts
lib/server/proof-ledger/proof-ledger-repository.ts
lib/server/proof-ledger/proof-projection.ts
lib/server/proof-ledger/errors.ts
tests/server/proof-ledger/proof-event-validator.test.ts
tests/server/proof-ledger/proof-ledger-repository.test.ts
tests/server/proof-ledger/proof-projection.test.ts
```

P0 本地数据路径：

```text
.nextcard-data/proof-ledger.json
```

## 必须实现的接口

```ts
validateProofEventRequest(request: ProofEventRequest, context: ProofValidationContext): ProofValidationResult
appendProofEvent(request: ProofEventRequest, context: ProofValidationContext): Promise<ProofEvent>
listProofEvents(scope: ProofScope, window?: ProofWindow): Promise<ProofEvent[]>
buildProofProjection(events: ProofEvent[]): ProofProjection
```

## Source / event 白名单

```text
deck-commit -> deck_committed
card-runtime -> card_started / card_completed / card_frozen / freeze_undone / burn_started / burn_resolved / card_deferred / reward_earned
time-guardian -> deadline_warning / soft_task_hardened
notification-adapter -> reminder_delivered
summary-service -> summary_accepted
```

其他组合全部拒绝。

## 必须拒绝的输入

- raw unconfirmed voice transcript。
- rejected transcript。
- unconfirmed OCR/PDF/notification extraction。
- PlanModeDraft output。
- unchosen A/B/C option。
- failed notification delivery as user behavior。
- model-generated completion without Card Runtime action。
- profile-generated proof。
- metadata 中出现 morality / diagnosis / discipline score。
- summary 中出现 `懒`、`低自律`、`拖延症`、`执行力差`、`人格评分`。

## Append-only 规则

- proof event 一旦 append，不允许 overwrite。
- correction 必须是新 event，使用 `correctionOfEventId` 指向原事件。
- 相同 `sourceService + sourceActionId + eventType` 的重复请求返回已有 event。
- 不同 summary 但相同 idempotency key 的请求视为 conflict。

## 测试重点

- Deck Commit 的 `deck_committed` 被接受。
- Deck Commit 的 `card_completed` 被拒绝。
- Card Runtime 的 `card_completed` 被接受。
- Time Guardian 的 `card_completed` 被拒绝。
- Notification Adapter 的 failed delivery 不能产生 `reminder_delivered`。
- PlanModeDraft output 不能作为 proof。
- raw transcript 不能作为 proof。
- 羞辱文案被拒绝。
- correction append 新 event，不改旧 event。
- projection 能生成 timeline / table 所需基础字段。

## 验收标准

- Proof Ledger 不 import DeckRepository writer。
- Proof Ledger 不 import CardRuntimeRepository writer。
- Proof Ledger 不 import Time Guardian queue writer。
- Proof Ledger 不暴露 public arbitrary write route。
- 所有 accepted events 都能追溯 `sourceService` 和 `sourceActionId`。

## 验证命令

```powershell
pnpm test tests/server/proof-ledger/proof-event-validator.test.ts tests/server/proof-ledger/proof-ledger-repository.test.ts tests/server/proof-ledger/proof-projection.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/proof-ledger/proof-event-validator.ts lib/server/proof-ledger/proof-ledger-repository.ts lib/server/proof-ledger/proof-projection.ts lib/server/proof-ledger/errors.ts tests/server/proof-ledger
git commit -m "feat: add append-only proof ledger"
```

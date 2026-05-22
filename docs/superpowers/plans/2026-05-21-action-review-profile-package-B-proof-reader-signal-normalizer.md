# 任务包 B：Proof Reader 与 Signal Normalizer 包

> **执行要求：** 本包只做 read-only proof 读取和中性 signal 聚合。不要写 proof，不要生成 profile policy，不要创建软任务，不要修改任何 deck/card/reminder 状态。

**目标：** 从已验证 proof events、card transitions、reminder audit 中生成 `ProofSignalAggregate`，并排除不可靠或未确认的数据。

**优先级：** P0

**依赖：** A

## 涉及文件

```text
lib/server/action-review/proof-reader.ts
lib/server/action-review/signal-normalizer.ts
tests/server/action-review/proof-reader.test.ts
tests/server/action-review/signal-normalizer.test.ts
tests/fixtures/action-review/*.json
```

## 输入合同

允许读取：

```text
verified proof events
card state transitions
completed/deferred/frozen/burning/rewarded events
actual duration
baseline reminder delivery audit
user response to delivered reminders
chosen A/B/C plan history
goal contract and quality debt
Time Guardian decisions as facts
```

必须排除：

```text
raw voice audio
rejected transcript
unconfirmed OCR/PDF facts
failed notification delivery as behavior evidence
missing notification permission as reliable reminder response
third-party reporting data
```

## 必须实现的接口

```ts
readProofEvents(userId, windowDays): ProofEventRef[]
normalizeProofSignals(events, reminderAudit): ProofSignalAggregate
```

`readProofEvents` 必须是只读函数。它不能 fabricate、delete、append 或 update proof。

## 必须计算的 signals

```text
firstCardStartDelayMinutes
actualVsEstimatedRatio
freezeRate
burnCompletionRate
deliveredReminderResponseRate
recoveryAfterFreezeMedianMinutes
shortCardCompletionRate
```

## 数据质量规则

- `evidenceCount` 只统计被接受的 verified events。
- `reminderDeliveryReliable=false` 时，不输出 delivered reminder response rate。
- failed delivery 只影响 delivery reliability，不影响用户响应率。
- no permission / in-app-only 状态下，外部提醒未响应不得被当作用户行为。
- empty proof 输出空 signals，`hasEnoughData=false`。

## 验收标准

- 第三层不能 fabricate proof。
- rejected transcript 和 unconfirmed multimodal facts 不进入 signal。
- failed delivery 不降低用户 reminder response。
- 所有 signal 名称保持中性，不包含 lazy、discipline、procrastination label。
- 输出只包含 `ProofSignalAggregate`。

## 验证命令

```powershell
pnpm test tests/server/action-review/proof-reader.test.ts tests/server/action-review/signal-normalizer.test.ts
pnpm typecheck
```

如果当前项目没有 `typecheck` 脚本，改用：

```powershell
pnpm exec tsc --noEmit --incremental false
```

## 建议提交

```powershell
git add lib/server/action-review/proof-reader.ts lib/server/action-review/signal-normalizer.ts tests/server/action-review tests/fixtures/action-review
git commit -m "feat: normalize action review proof signals"
```

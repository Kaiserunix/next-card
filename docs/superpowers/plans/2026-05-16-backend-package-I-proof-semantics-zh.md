# 任务包 I：Proof 语义收敛包

> **执行要求：** 本包先用测试定义 proof 语义，再做最小修正。不要先大重构。

**目标：** 明确 proof 是行动证据，避免把“生成计划”“开始燃烧”“完成卡片”“完成目标”混成同一种状态。

**优先级：** P1

**依赖：** 任务包 D、E

**涉及文件：**

```text
store/useNextCardStore.ts
lib/mock-ai.ts
tests/store/proof-semantics.test.ts
```

## 需要锁定的语义

### selectPlan

- 应记录为 `in-progress`。
- progress 为 0。
- actualMinutes 为 0。
- 不应算 completed。
- 不应提前写成 `burning-completed`。

### startFocusTiming

- 是 timing event。
- 不增加 completedCards。
- 不改变 deck 完成度。

### startQuickBurning

- 是 burn event。
- 可以记录 `lastDamageEffect: "burn"`。
- 不增加 completedCards。
- 不直接判失败。

### completeCurrentCard

- 是 card completion event。
- 增加 completedCards。
- progress 上升。
- 记录 actualMinutes。
- 如果是 burning 模式完成，`timeStatus` 为 `burning-completed`。

### freezeCurrentCard

- status 为 `frozen`。
- `timeStatus` 为 `frozen-rescheduled`。
- frozenCards 增加。
- `lastDamageEffect` 为 `freeze`。

### 全 deck 完成

- 生成 rewardCard。
- 最新 proof record 为 `rewarded`。
- progress 为 100。

## 当前需要重点检查的问题

`selectPlan` 生成第一张 burning demo card 时，不应把 proof record 写成已经 `burning-completed`。更合理的是：

```text
timeStatus: "on-time"
timeDamageEvents: ["生成第一张近截止燃烧演示卡"]
lastDamageEffect: "burn"
```

## 后续可选重构

如果 proof 继续复杂化，可以拆成两层：

```text
ProofEvent
ProofAggregate
```

当前 MVP 可以先不改类型，只用测试锁住事件含义。

## 验收标准

- proof table、journal、summary 的数据含义一致。
- burning demo 不被误判为已经完成 burning。
- reward 只在 deck 完成后出现。

## 验证命令

```bash
pnpm test tests/store/proof-semantics.test.ts
pnpm test tests/store/deck-actions.test.ts
```

## 建议提交

```bash
git add tests/store/proof-semantics.test.ts store/useNextCardStore.ts
git commit -m "test: lock proof event semantics"
```

# 任务包 F：localStorage 持久化测试包

> **执行要求：** 本包只测试持久化范围和恢复所需的数据，不引入真实数据库。

**目标：** 确认刷新页面后，历史 deck、proof、冻结队列、奖励卡等关键业务状态能保留。

**优先级：** P1

**依赖：** 任务包 C、D、E

**涉及文件：**

```text
store/useNextCardStore.ts
tests/store/persistence.test.ts
```

## 持久化 key

```text
next-card-mvp
```

## 需要验证的保存范围

当前 `partialize` 应保存：

```text
inputs
analysis
analysisStatus
plans
taskFlow
deck
proofs
```

## 测试场景

### 生成 deck 后

localStorage 应保存：

- `inputs.text`
- `analysis`
- `plans`
- `taskFlow.nodes`
- `deck.decks`
- `deck.activeDeckId`
- `deck.currentCardId`
- `proofs.records`
- `proofs.summaryDocument`

### 冻结后

localStorage 应保存：

- `deck.frozenCardIds`
- `deck.rescheduleQueue`
- frozen card 的 status/damageEffect。
- proof 里的 frozen record。

### 完成后

localStorage 应保存：

- `deck.completedCardIds`
- `deck.decks[].completedCards`
- completed card 的 elapsedSeconds。
- proof 里的 completion record。

### 完成整副 deck 后

localStorage 应保存：

- `deck.rewardCards`
- deckStatus 为 `completed`。
- proof reward record。

## 不应作为权威后端状态的内容

- 纯 UI 展示状态。
- 临时弹窗开关。
- 动画中间态。

## 验收标准

- 刷新后主链路数据能恢复。
- Android WebView 只需要开启 DOM storage。
- 持久化测试不接真实后端。

## 验证命令

```bash
pnpm test tests/store/persistence.test.ts
```

## 建议提交

```bash
git add tests/store/persistence.test.ts
git commit -m "test: cover persisted next card state"
```

# 任务包 E：Deck 行为状态机测试包

> **执行要求：** 本包测试 deck 核心执行行为。UI 同事可以继续改视觉，但这些 store 行为不能被破坏。

**目标：** 测住 deck 单卡执行闭环：打开 deck、开始计时、快速燃烧、完成、冻结、奖励。

**优先级：** P0

**依赖：** 任务包 C

**涉及文件：**

```text
store/useNextCardStore.ts
tests/store/deck-actions.test.ts
```

## 需要测试的 action

```text
openDeck
startFocusTiming
startQuickBurning
completeCurrentCard
freezeCurrentCard
continueCurrentCard
```

## 测试场景

### 打开 deck

- `openDeck(deckId)` 后：
  - mode 为 `deck`。
  - `activeDeckId` 正确。
  - `currentCardId` 指向当前 active card。

### 双击计时

对应 store action：`startFocusTiming()`。

- `activeTimeMode` 变为 `timing`。
- 当前 card 写入 `startedAt`。
- 当前 card 保持或变为 `active`。
- proof 写入“开始计时”事件。

### 三击快速燃烧

对应 store action：`startQuickBurning()`。

- `activeTimeMode` 变为 `burning`。
- 当前 card：
  - `urgencyStage` 为 `burning`。
  - `damageEffect` 为 `burn`。
  - `burnLevel` 为 3。
  - `damageProgress` 提高。
- proof 写入燃烧事件。

### 左/右滑完成

对应 store action：`completeCurrentCard("left" | "right")`。

- 当前 card status 变为 `completed`。
- `completedCardIds` 增加。
- `deck.completedCards` 增加。
- `currentCardId` 前进到下一张 queued card。
- proof 写入完成事件。
- actualMinutes 大于 0。

### 冻结

对应 store action：`freezeCurrentCard()`。

- 当前 card status 变为 `frozen`。
- `damageEffect` 变为 `freeze`。
- `frozenCardIds` 增加。
- `rescheduleQueue` 增加。
- `activeTimeMode` 变为 `paused`。
- proof 写入 `frozen-rescheduled`。

### 完成整副 deck

- 所有 card 完成后：
  - `deckStatus` 为 `completed`。
  - `rewardCards` 增加。
  - proof 最新记录为 `rewarded`。

## 验收标准

- deck 行为不依赖 UI 动画。
- 完成、冻结、燃烧都能写 proof。
- 单卡执行体验的后端状态稳定。

## 验证命令

```bash
pnpm test tests/store/deck-actions.test.ts
```

## 建议提交

```bash
git add tests/store/deck-actions.test.ts
git commit -m "test: cover deck action state machine"
```

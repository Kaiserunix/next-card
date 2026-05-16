# 任务包 H：冻结恢复队列包

> **执行要求：** 本包补齐 `rescheduleQueue` 的后端行为：冻结后不仅记录，还能恢复。

**目标：** 新增恢复 frozen card 的 store action，让冻结任务能从 reschedule queue 回到执行流。

**优先级：** P1

**依赖：** 任务包 E、G

**涉及文件：**

```text
store/useNextCardStore.ts
tests/store/time-and-reschedule.test.ts
```

## 当前问题

- `freezeCurrentCard()` 已经把 card id 放入 `rescheduleQueue`。
- 目前缺少恢复 frozen card 的 store action。
- README 已把 resume screen / reschedule queue 列为下一步。

## 建议新增 action

```text
resumeFrozenCard(cardId: string)
```

## 业务规则

- 只有 status 为 `frozen` 的 card 可以恢复。
- 恢复后：
  - card status 变为 `active`。
  - `damageEffect` 清为 `none`。
  - `damageProgress` 清为 0。
  - `burnLevel` 清为 0。
  - `urgencyStage` 变为 `warm`，或通过时间引擎重算。
  - `suggestedStartAt` 更新为当前时间。
  - 从 `rescheduleQueue` 移除。
  - 从 `frozenCardIds` 移除。
  - `currentCardId` 指向恢复卡。
  - `activeDeckId` 指向恢复卡所在 deck。
  - `activeTimeMode` 回到 `idle`。

- 如果原来已有 active card，应把原 active card 退回 `queued`，避免一副 deck 同时多个 active card。

- 无效 cardId 或非 frozen card：
  - 不改变状态。
  - 不写 proof。

## Proof 要求

恢复 frozen card 时写入 proof record：

- `status`: `in-progress`
- `timeStatus`: `frozen-rescheduled`
- `timeDamageEvents`: 包含 `从 reschedule queue 恢复冻结卡`
- `lastAction`: `恢复冻结卡：${card.title}`
- `nextSuggestion`: 提示继续完成或再次冻结。

## 验收标准

- 冻结卡可以恢复。
- 不需要重新分析原始输入。
- 恢复事件进入 proof。
- 状态中不会出现多个 active card。

## 验证命令

```bash
pnpm test tests/store/time-and-reschedule.test.ts
```

## 建议提交

```bash
git add store/useNextCardStore.ts tests/store/time-and-reschedule.test.ts
git commit -m "feat: resume frozen cards from reschedule queue"
```

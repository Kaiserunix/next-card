# 任务包 G：Card Time Engine 时间引擎包

> **执行要求：** 先写测试，再抽业务函数。不要把时间逻辑继续散落在 UI 组件里。

**目标：** 把 card urgency 刷新逻辑抽成可测试业务函数，供刷新、恢复、未来提醒服务复用。

**优先级：** P1

**依赖：** 任务包 B

**涉及文件：**

```text
lib/card-time-engine.ts
tests/lib/card-time-engine.test.ts
store/useNextCardStore.ts
```

## 建议新增函数

```text
refreshCardTimeState(card, now)
refreshDeckTimeState(deck, now)
```

## 业务规则

- `queued` 和 `active` card 可以刷新 urgency。
- `completed`、`frozen`、`rewarded`、`needs-review` card 不应被时间刷新破坏。
- deadline 过期后：
  - `urgencyStage` 为 `expired`。
  - `damageEffect` 为 `crack`。
  - `remainingSeconds` 为 0。
  - `damageProgress` 为 100。

## Store 需要新增 action

```text
refreshActiveDeckTime(nowIso?)
```

## 测试场景

- 距 deadline 30 分钟：`calm`。
- 距 deadline 15 分钟：`hot`。
- 距 deadline 2 分钟：`burning`。
- deadline 已过：`expired` + `crack`。
- frozen card 不被刷新成 expired/crack。
- completed card 不被刷新。
- active deck 刷新不写 proof record，避免 noisy log。

## 验收标准

- 时间逻辑可独立测试。
- store 能手动刷新 active deck 时间状态。
- UI 未来只调用 store action 或读取已刷新状态。

## 验证命令

```bash
pnpm test tests/lib/card-time-engine.test.ts
pnpm test tests/store/time-and-reschedule.test.ts
```

## 建议提交

```bash
git add lib/card-time-engine.ts tests/lib/card-time-engine.test.ts store/useNextCardStore.ts
git commit -m "feat: add card time refresh engine"
```

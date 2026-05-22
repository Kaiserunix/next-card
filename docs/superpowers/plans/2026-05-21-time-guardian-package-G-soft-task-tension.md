# 任务包 G：Soft Task Good Line 与 Tension Classifier 包

> **执行要求：** 本包实现 soft task 的调度判断，不做人格评价，不把 soft task 推迟写成失败。

**目标：** 让第二层能判断 soft task 何时可选、何时推荐、何时 deadline-sensitive，并输出 explainable `UpdateSoftTaskTensionAction`。

**优先级：** P1

**依赖：** 任务包 A、B、C、F

## 涉及文件

```text
lib/server/time-guardian/task-tension-classifier.ts
lib/server/time-guardian/soft-task-good-line.ts
lib/server/time-guardian/soft-task-surface-service.ts
tests/server/time-guardian/task-tension-classifier.test.ts
tests/server/time-guardian/soft-task-good-line.test.ts
tests/server/time-guardian/soft-task-surface-service.test.ts
```

## SoftTaskTiming

```ts
type SoftTaskTiming = {
  recommendedGoodLineAt: string | null;
  mustNudgeAfterAt: string | null;
  deadlineAt: string | null;
  hardensAt: string | null;
  reason: string;
};
```

## Tension 规则

```text
hard: class/exam/submission/fixed/user-locked
deadline-sensitive: deadline exists and slack is narrowing
recommended: useful soon, still flexible
soft: optional before good line
background: only surface in favorable context
unknown: needs review
```

## Good Line 行为

- `now < recommendedGoodLineAt`：soft optional。
- `now >= recommendedGoodLineAt`：可以 gentle nudge。
- `now >= mustNudgeAfterAt`：可以更频繁 nudge，但受 cap 限制。
- `now >= hardensAt`：转为 deadline-sensitive 或 needs-review。

## 禁止事项

- 不使用 lazy / 自律差 / 失败 等标签。
- 不把 soft defer 写成 proof failure。
- 不让 soft task 挤占 hard lock。
- 不静默移动 DDL。
- 不降低 baselineGoal 或 standardGoal。

## 验收用例

- 预习任务在 good line 前保持 `soft`。
- 到达 good line 后输出 gentle `soft-task-surface`。
- 超过 hardensAt 后输出 `deadline-sensitive`，reason 说明时间依据。
- Agent3 生成的系统任务默认是 `soft`。
- soft task 在用户锁定时间内不被插入。
- soft task 被推迟时不产生失败文案。

## 验证命令

```powershell
pnpm test tests/server/time-guardian/task-tension-classifier.test.ts tests/server/time-guardian/soft-task-good-line.test.ts tests/server/time-guardian/soft-task-surface-service.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/time-guardian/task-tension-classifier.ts lib/server/time-guardian/soft-task-good-line.ts lib/server/time-guardian/soft-task-surface-service.ts tests/server/time-guardian
git commit -m "feat: add soft task tension rules"
```

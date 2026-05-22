# 任务包 H：Freeze Return Queue 与红队/Skill 草案包

> **执行要求：** 本包实现 frozen card 回流计划，并准备第二层红队用例和 skill 草案。不要直接安装 skill，不要写最终 skill。

**目标：** 让冻结不等于删除或失败；frozen card/deck 回到 Time Guardian review，可重新插入、继续冻结或请求用户复核。

**优先级：** P1

**依赖：** A-G

## 涉及文件

```text
lib/server/time-guardian/freeze-return-service.ts
lib/server/time-guardian/frozen-queue-policy.ts
tests/server/time-guardian/freeze-return-service.test.ts
tests/server/time-guardian/frozen-queue-policy.test.ts
docs/superpowers/specs/2026-05-21-time-guardian-redteam-cases.md
docs/superpowers/specs/2026-05-21-time-guardian-skill-draft.md
```

## Freeze Return 行为

输入：

```text
FrozenQueueItem
ScheduleSnapshot
TaskTension
DeadlineWarning
AgentPolicySnapshot
```

输出：

```text
ReinsertFrozenCardAction
RequestUserReviewAction
InsertScheduleEventAction(kind="freeze-return")
```

可做：

- 重新插入今天。
- 重新插入明天。
- 转成更小第一步。
- 保持 frozen。
- 如果 deadline 风险变化，请用户 review。

禁止：

- 删除 frozen card。
- 标记失败。
- 自动完成。
- 降低 baselineGoal / standardGoal。
- 绕过 hard lock。

## 红队用例

至少覆盖：

1. 8:00 class 默认 baseline reminder 应为 7:30。
2. agent-refined nudge 不能删除 baseline。
3. notification denied 不能说外部提醒已设置。
4. 用户把卡推迟到考试时间。
5. 用户选择 C 方案，系统试图按 A 方案提醒。
6. soft task 在 good line 前被反复强推。
7. soft task hardens 后文案羞辱用户。
8. frozen card 被系统删除。
9. reminder delivery failed 被算作用户忽略。
10. unverified OCR 课程时间被写成 hard lock。

## Skill 草案定位

建议 skill 名称：

```text
nextcard-time-guardian-queue-actions
```

触发描述草案：

```yaml
description: Use when implementing or reviewing Next Card time scheduling, schedule event insertion, TimeLock protection, QueueAction validation, reminders, deadline warnings, soft-task timing, or frozen-card return behavior
```

Skill 必须教会执行 agent：

- 自动插入内部事件是核心功能。
- 但所有插入必须过 QueueAction。
- baseline reminder 按目标时间减用户 lead time 计算。
- 8:00 + 30min = 7:30，不是 7:00。
- hard lock 不能静默移动。
- 无权限不能假装外部提醒。
- failed delivery 不是用户忽略。
- soft task hardening 不是道德评价。
- frozen card 回流不是删除。

## 验证命令

```powershell
pnpm test tests/server/time-guardian/freeze-return-service.test.ts tests/server/time-guardian/frozen-queue-policy.test.ts
pnpm typecheck
```

文档草案人工检查：

```text
1. 检查红队用例是否覆盖 baseline reminder、hard lock、notification capability、chosenPlanId、soft task、freeze。
2. 检查 skill 草案是否禁止直接写 proof/profile。
3. 检查所有例子中 8:00 默认 baseline reminder 是否为 7:30。
```

## 建议提交

```powershell
git add lib/server/time-guardian/freeze-return-service.ts lib/server/time-guardian/frozen-queue-policy.ts tests/server/time-guardian docs/superpowers/specs/2026-05-21-time-guardian-redteam-cases.md docs/superpowers/specs/2026-05-21-time-guardian-skill-draft.md
git commit -m "feat: add frozen card return planning"
```

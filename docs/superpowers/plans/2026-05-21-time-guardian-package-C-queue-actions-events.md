# 任务包 C：QueueAction 与内部事件插入包

> **执行要求：** 本包实现第二层的受控写入表达。所有 schedule mutation 必须是 `QueueAction`，自动插入事件必须是内部 `ScheduledEvent`。不要接外部日历或系统通知。

**目标：** 建立 `QueueActionValidator` 和 `ScheduledEventInserter`，保证“自动分析、插入事件”这个核心功能可用且不越权。

**优先级：** P0

**依赖：** 任务包 A、B

## 涉及文件

```text
lib/server/time-guardian/queue-action-validator.ts
lib/server/time-guardian/scheduled-event-inserter.ts
lib/server/time-guardian/idempotency.ts
tests/server/time-guardian/queue-action-validator.test.ts
tests/server/time-guardian/scheduled-event-inserter.test.ts
tests/server/time-guardian/idempotency.test.ts
```

## QueueAction 必须覆盖

```text
InsertScheduleEventAction
ScheduleCardAction
DeferCardAction
FreezeCardAction
ReinsertFrozenCardAction
CreateBaselineReminderAction
CreateNudgeReminderAction
UpdateSoftTaskTensionAction
EmitDeadlineWarningAction
RequestUserReviewAction
```

## Validator 检查项

- `snapshotId` 存在且匹配当前快照。
- `chosenPlanId` 一致。
- 插入窗口不撞 hard lock。
- nudge 不删除 baseline reminder。
- external notification 需要权限。
- idempotency key 防止重复插入。
- model-proposal 不能直接变成 authority write，必须通过 validator。
- action reason 非空。

## 内部事件插入规则

允许插入：

- `card-window`
- `baseline-reminder`
- `nudge-reminder`
- `deadline-warning`
- `soft-task-surface`
- `soft-task-harden`
- `freeze-return`
- `review-request`
- `in-app-reminder`

禁止插入：

- unverified class hard lock。
- unverified exam hard lock。
- unverified submission deadline。
- external calendar event。
- proof completion event。
- profile update event。

## 验收用例

- verified 8:00 class 可以插入 `07:25 card-window` 和 `07:30 baseline-reminder`。
- unverified OCR 8:00 class 不能插入 `class_time TimeLock`。
- 同一个 idempotency key 重复提交不会创建双事件。
- 用户选择 C plan 时，A/B plan card action 被拒绝。
- model-proposal 只能在 validator 通过后成为 inserted event。

## 验证命令

```powershell
pnpm test tests/server/time-guardian/queue-action-validator.test.ts tests/server/time-guardian/scheduled-event-inserter.test.ts tests/server/time-guardian/idempotency.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/time-guardian/queue-action-validator.ts lib/server/time-guardian/scheduled-event-inserter.ts lib/server/time-guardian/idempotency.ts tests/server/time-guardian
git commit -m "feat: validate time guardian queue actions"
```

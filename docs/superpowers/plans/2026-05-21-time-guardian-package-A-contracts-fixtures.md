# 任务包 A：Time Guardian 合同与 Fixture 包

> **执行要求：** 本包只定义第二层共享类型、fixture 和合同测试。不要实现排程算法、真实通知、日历同步或 UI。

**目标：** 建立 `TimeLock`、`ScheduledEvent`、`ScheduleSnapshot`、`QueueAction`、`ReminderPlan`、`SoftTaskTiming` 的稳定合同，后续任务包全部复用。

**优先级：** P0

**依赖：** 无。应最先执行。

## 涉及文件

```text
docs/superpowers/specs/2026-05-21-time-guardian-contract.md
lib/server/time-guardian/types.ts
tests/server/time-guardian/time-guardian-fixtures.test.ts
tests/fixtures/time-guardian/*.json
```

如果当前 repo 还没有 `lib/server/time-guardian/` 或 `tests/server/time-guardian/`，本包负责创建目录。

## 必须定义的核心类型

```ts
type TimeLockKind =
  | "class_time"
  | "exam_time"
  | "submission_deadline"
  | "fixed_calendar_event"
  | "user_locked_block";

type TaskTension =
  | "hard"
  | "deadline-sensitive"
  | "recommended"
  | "soft"
  | "background"
  | "unknown";

type ScheduledEventKind =
  | "card-window"
  | "baseline-reminder"
  | "nudge-reminder"
  | "deadline-warning"
  | "soft-task-surface"
  | "soft-task-harden"
  | "freeze-return"
  | "review-request"
  | "in-app-reminder";

type NotificationCapability =
  | "unknown"
  | "external_granted"
  | "external_denied"
  | "external_revoked"
  | "in_app_only";
```

必须包含这些对象：

```text
TimeLock
TimeWindow
ScheduledEvent
ScheduledCard
ScheduleSnapshot
ReminderPlan
SoftTaskTiming
QueueAction
QueueActionBase
TimeGuardianDecision
```

## 必须准备的 fixtures

```text
verified-class-8am.json
assignment-deadline-tonight.json
chosen-plan-c-only.json
soft-task-before-good-line.json
soft-task-after-hardens-at.json
frozen-card-awaiting-return.json
notification-permission-denied.json
conflict-with-user-locked-block.json
failed-reminder-delivery.json
unverified-ocr-class-time.json
```

## 合同测试重点

- `TimeLock.movable` 必须为 `false`。
- `ScheduledEvent` 是内部事件，不等于外部系统日历事件。
- `QueueAction` 必须包含 `snapshotId`、`actor`、`reason`、`createdAt`。
- `ReminderPlan.kind="baseline"` 必须有 `source="system-fallback"` 或 `user-fixed`。
- `NotificationCapability !== "external_granted"` 时 fixture 不能出现 external scheduled job。
- unverified OCR fixture 不能包含 verified hard lock。

## 验收标准

- 类型层面能表达自动插入内部事件。
- 类型层面能区分 baseline reminder、nudge reminder、deadline warning。
- 类型层面能表达 chosenPlanId，避免调度未选择方案。
- fixture 覆盖 hard lock、soft task、freeze、通知降级、冲突、未确认 OCR。
- 不出现 proof/profile 权威写入类型作为 Time Guardian 直接输出。

## 验证命令

```powershell
pnpm test tests/server/time-guardian/time-guardian-fixtures.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add docs/superpowers/specs/2026-05-21-time-guardian-contract.md lib/server/time-guardian/types.ts tests/server/time-guardian tests/fixtures/time-guardian
git commit -m "docs: define time guardian contracts"
```

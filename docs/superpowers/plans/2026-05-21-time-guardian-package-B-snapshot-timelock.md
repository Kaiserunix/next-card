# 任务包 B：Schedule Snapshot 与 TimeLock Validator 包

> **执行要求：** 本包建立时间世界快照和 hard lock 校验。不要创建提醒，不要做 soft task hardening，不要写 proof。

**目标：** 让所有 Time Guardian 动作都基于 versioned `ScheduleSnapshot`，并通过 `TimeLockValidator` 防止课程、考试、DDL、用户锁定块被静默移动或覆盖。

**优先级：** P0

**依赖：** 任务包 A

## 涉及文件

```text
lib/server/time-guardian/schedule-snapshot-builder.ts
lib/server/time-guardian/time-lock-validator.ts
lib/server/time-guardian/time-overlap.ts
tests/server/time-guardian/schedule-snapshot-builder.test.ts
tests/server/time-guardian/time-lock-validator.test.ts
tests/server/time-guardian/time-overlap.test.ts
```

## Snapshot 输入

```ts
type BuildScheduleSnapshotInput = {
  now: string;
  timezone: string;
  committedDecks: ScheduledDeckRef[];
  activeCards: ScheduledCardRef[];
  scheduledEvents: ScheduledEvent[];
  timeLocks: TimeLock[];
  availableWindows: TimeWindow[];
  frozenQueue: FrozenQueueItem[];
  policySnapshotId?: string;
};
```

输出：

```ts
type BuildScheduleSnapshotResult = {
  snapshot: ScheduleSnapshot;
};
```

## TimeLock Validator 需要支持的判断

```ts
type TimeLockValidationResult =
  | { allowed: true; reason: string }
  | {
      allowed: false;
      reason: string;
      conflictLockIds: string[];
      requiresUserReview: boolean;
    };
```

## 必须拒绝的情况

- 把 card window 插入到 class_time 内。
- 把 defer 后窗口放到 submission_deadline 之后。
- 试图移动 `movable: false` 的 TimeLock。
- 把 recurring class 当 one-off 删除。
- 覆盖 user_locked_block。
- 用 unverified OCR/PDF/notification 事实创建 hard lock。

## 验收用例

- `08:00-09:30` class_time 存在时，`08:20-08:40` card-window 被拒绝。
- `20:00` submission_deadline 存在时，`20:30` defer 被拒绝。
- 用户锁定 `12:00-13:00` 午休块时，不能自动插入 soft task。
- snapshot 必须有稳定 `snapshotId` 或可追踪版本。
- 所有 validator 输出都包含可给用户解释的 reason。

## 验证命令

```powershell
pnpm test tests/server/time-guardian/schedule-snapshot-builder.test.ts tests/server/time-guardian/time-lock-validator.test.ts tests/server/time-guardian/time-overlap.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/time-guardian/schedule-snapshot-builder.ts lib/server/time-guardian/time-lock-validator.ts lib/server/time-guardian/time-overlap.ts tests/server/time-guardian
git commit -m "feat: add schedule snapshot and time lock validation"
```

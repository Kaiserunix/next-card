# 任务包 F：Deadline Warning 与 Recovery 请求包

> **执行要求：** 本包只计算 deadline risk 和 recovery 请求。不要自动降低目标，不要自动删除卡片，不要直接生成新 A/B/C deck。

**目标：** 实现 `DeadlineWarningEngine`，让系统能基于 slack 判断 `watch / risk / critical`，并生成恢复建议请求。

**优先级：** P1

**依赖：** 任务包 A、B、C、E

## 涉及文件

```text
lib/server/time-guardian/deadline-warning-engine.ts
lib/server/time-guardian/slack-calculator.ts
lib/server/time-guardian/recovery-request-service.ts
tests/server/time-guardian/deadline-warning-engine.test.ts
tests/server/time-guardian/slack-calculator.test.ts
tests/server/time-guardian/recovery-request-service.test.ts
```

## Warning Level

```ts
type DeadlineWarningLevel = "none" | "watch" | "risk" | "critical";
```

计算依据：

- `dueAt - now`
- remaining estimated work
- fixed busy time
- safety buffer
- completed progress
- estimate confidence

## 输出

```ts
type DeadlineWarning = {
  level: DeadlineWarningLevel;
  reason: string;
  affectedCardIds: string[];
  suggestedRecoveryOptions: RecoveryOption[];
};
```

## Recovery 请求规则

Deadline warning 可以输出：

- `EmitDeadlineWarningAction`
- `RequestUserReviewAction`
- `RecoveryOption[]`

不能输出：

- automatic goal downgrade。
- proof failure。
- completed state。
- hard lock movement。

## 验收用例

- 剩余时间充足 -> `none`。
- 估算工作量接近剩余窗口 -> `watch`。
- 固定课程挤压导致 slack 不足 -> `risk`。
- DDL 前剩余时间小于最低执行时长 -> `critical`。
- warning 不修改 baselineGoal / standardGoal。
- recovery option 只建议更小 progressGoal 或重新安排，不删除目标。

## 验证命令

```powershell
pnpm test tests/server/time-guardian/deadline-warning-engine.test.ts tests/server/time-guardian/slack-calculator.test.ts tests/server/time-guardian/recovery-request-service.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/time-guardian/deadline-warning-engine.ts lib/server/time-guardian/slack-calculator.ts lib/server/time-guardian/recovery-request-service.ts tests/server/time-guardian
git commit -m "feat: add deadline warning engine"
```

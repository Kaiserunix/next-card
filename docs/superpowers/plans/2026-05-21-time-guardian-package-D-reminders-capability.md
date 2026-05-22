# 任务包 D：Baseline Reminder 与通知权限降级包

> **执行要求：** 本包只做提醒计划和权限状态，不做真实 Web Push、系统通知发送、原生日历或手机 alarm。外部通知能力只建 adapter slot。

**目标：** 保证每个 verified time-protected card 都有 baseline reminder，并且在没有外部通知权限时诚实降级为 `in-app-only`。

**优先级：** P0

**依赖：** 任务包 A、C

## 涉及文件

```text
lib/server/time-guardian/reminder-baseline-service.ts
lib/server/time-guardian/notification-capability.ts
lib/server/time-guardian/reminder-plan-service.ts
tests/server/time-guardian/reminder-baseline-service.test.ts
tests/server/time-guardian/notification-capability.test.ts
tests/server/time-guardian/reminder-plan-service.test.ts
```

## Baseline Reminder 规则

默认：

```text
targetTime - 30min
```

用户可设：

```text
15 / 30 / 45 / custom
```

如果当前时间已经晚于 baseline fireAt：

```text
fireAt = now
reason = "Less time remains than reminder lead time."
```

示例：

```text
targetTime: 08:00
lead: 30min
baseline fireAt: 07:30
```

## 通知权限规则

```ts
type NotificationCapability =
  | "unknown"
  | "external_granted"
  | "external_denied"
  | "external_revoked"
  | "in_app_only";
```

- `external_granted`：可以计划外部通知 adapter job。
- 其他状态：只能创建 `in-app-only` reminder state。
- UI/返回 copy 必须说清楚“当前只能应用内提醒”。
- delivery failed 不能计为用户忽略。

## agent-refined nudge 规则

- 可以增加 `nudge-reminder`。
- 不能删除 baseline reminder。
- 不能超过 frequency cap。
- 不能绕过 quiet hours。
- 不能在权限缺失时声称外部通知已设置。

## 验收用例

- 08:00 hard lock + 默认 30min -> 07:30 baseline reminder。
- 08:00 hard lock + 用户 15min -> 07:45 baseline reminder。
- 当前 07:50 + 08:00 hard lock + 30min lead -> fireAt = now。
- notification denied -> `in-app-only`，不创建 external job。
- agent-refined nudge 删除 baseline 的 action 被拒绝。
- delivery failed 不产生 user ignored signal。

## 验证命令

```powershell
pnpm test tests/server/time-guardian/reminder-baseline-service.test.ts tests/server/time-guardian/notification-capability.test.ts tests/server/time-guardian/reminder-plan-service.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/time-guardian/reminder-baseline-service.ts lib/server/time-guardian/notification-capability.ts lib/server/time-guardian/reminder-plan-service.ts tests/server/time-guardian
git commit -m "feat: add baseline reminder planning"
```

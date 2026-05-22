# 任务包 C：默认 Profile Aggregator 与静态 Policy Engine 包

> **执行要求：** 本包实现 MVP 默认 profile 和静态 future-facing policy。不要开启自动画像，不要写用户可见 profile 页面，不要根据行为改 active deck。

**目标：** 在第三层未启用自适应学习时，也能给 Layer 1/2 提供安全、可预测、可版本化的默认 policy snapshot。

**优先级：** P0

**依赖：** A、B

## 涉及文件

```text
lib/server/action-review/profile-aggregator.ts
lib/server/action-review/policy-engine.ts
tests/server/action-review/profile-aggregator.test.ts
tests/server/action-review/policy-engine.test.ts
```

## 必须实现的接口

```ts
buildDefaultProfile(userId): ProfileSnapshot
aggregateProfile(signals, previousProfile, options): ProfileSnapshot
buildPolicySnapshot(profile, userPreferences): AgentPolicySnapshot
```

## MVP Profile 规则

- 默认 profile mode 为 `default`。
- 所有维度默认为 `unknown`。
- 默认 confidence 为 `0`。
- 默认 evidenceIds 为空。
- `userEditable=true`。
- `resettable=true`。
- 自动更新关闭时，`aggregateProfile` 必须返回 previous/default profile，不生成 active inferred profile。

## 默认 presets

必须支持这些用户显式偏好 preset：

```text
default-balanced
low-pressure-start
short-card-focus
more-buffer
light-reminders
```

这些是 preference preset，不是人格类型。

## 静态 Policy 规则

`AgentPolicySnapshot` 只能影响：

```text
future first card size
future card minute range
future buffer size
future reminder tone
future nudge daily cap
future burn sensitivity
future freeze recovery style
future optional continuation card suggestion
```

禁止影响：

```text
deadline
hard lock
baseline reminder existence
chosen plan override
proof
baselineGoal
standardGoal
committed deck/card/reminder
```

## preset 行为建议

```text
default-balanced: balanced intensity, standard granularity, normal reminder
low-pressure-start: minimal intensity, micro first card, light reminder
short-card-focus: balanced intensity, micro/standard card range, normal reminder
more-buffer: balanced intensity, higher bufferMultiplier, normal reminder
light-reminders: balanced intensity, normal cards, lower nudgeDailyCap
```

## 验收标准

- 默认 profile 符合 A 包合同。
- static policy 必须 versioned。
- policy `appliesTo` 默认为 `future-planning-only`。
- 用户 preference 只能改变 future candidate hints。
- 测试证明 policy 不能表达 TimeLock move、baseline reminder delete、goal reduction。

## 验证命令

```powershell
pnpm test tests/server/action-review/profile-aggregator.test.ts tests/server/action-review/policy-engine.test.ts
pnpm typecheck
```

如果当前项目没有 `typecheck` 脚本，改用：

```powershell
pnpm exec tsc --noEmit --incremental false
```

## 建议提交

```powershell
git add lib/server/action-review/profile-aggregator.ts lib/server/action-review/policy-engine.ts tests/server/action-review
git commit -m "feat: add default action review profile policy"
```

# 任务包 F：Profile Governance 与 Reset Controls 包

> **执行要求：** 本包实现第三层个性化控制的 service 层合同。MVP 不要求 UI 页面，不要求自动画像默认开启。

**目标：** 提供 opt-in/opt-out、reset、versioning、evidence window、confidence threshold、experiment flag 等治理能力，确保 profile 可控、可关闭、可重置。

**优先级：** P1 / V1

**依赖：** A、C；建议等 B-D 基本稳定后执行。

## 涉及文件

```text
lib/server/action-review/profile-governance.ts
tests/server/action-review/profile-governance.test.ts
```

## 必须实现的行为

```text
create default governance settings
enable personalization explicitly
disable personalization
reset profile to default unknown state
create next profile version
hold evidence window setting
hold confidence threshold setting
hold experiment flags
prevent policy from mutating active committed deck
```

## 建议合同

```ts
type ProfileGovernanceSettings = {
  userId: string;
  personalizationEnabled: boolean;
  autoUpdateEnabled: boolean;
  evidenceWindowDays: 7 | 14 | 30 | 90;
  minimumEvidenceCount: number;
  minimumConfidence: number;
  experimentFlags: string[];
  updatedAt: string;
};
```

必须有 service 方法：

```ts
buildDefaultGovernanceSettings(userId)
enablePersonalization(settings)
disablePersonalization(settings)
resetProfile(userId, previousProfile)
createProfileCandidate(settings, aggregate, previousProfile)
```

## 安全规则

- 默认 `personalizationEnabled=false`。
- 默认 `autoUpdateEnabled=false`。
- reset 后所有维度回到 `unknown`，confidence 为 `0`。
- old policy snapshot 不能影响已 commit deck。
- disabled personalization 时，不能创建 active inferred profile。
- experiment flag 不得绕过 Time Guardian、Review Gate、A/B/C Plan Mode。

## 验收标准

- 用户能禁用个性化。
- 用户能 reset profile。
- reset 不删除 proof，只断开 active profile/policy 影响。
- version 单调递增或明确重置为新 default version。
- 低 evidence / 低 confidence 只能产生 candidate，不得自动 active。

## 验证命令

```powershell
pnpm test tests/server/action-review/profile-governance.test.ts
pnpm typecheck
```

如果当前项目没有 `typecheck` 脚本，改用：

```powershell
pnpm exec tsc --noEmit --incremental false
```

## 建议提交

```powershell
git add lib/server/action-review/profile-governance.ts tests/server/action-review/profile-governance.test.ts
git commit -m "feat: add profile governance controls"
```

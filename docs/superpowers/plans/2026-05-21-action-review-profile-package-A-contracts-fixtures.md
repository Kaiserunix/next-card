# 任务包 A：行动回顾 / 节奏适配层合同与 Fixture 包

> **执行要求：** 本包只定义第三层共享类型、fixture 和合同测试。不要实现自动画像、软任务生成、真实存储、UI 或任何权威状态写入。

**目标：** 建立 `ProofSignalAggregate`、`ProfileSnapshot`、`AgentPolicySnapshot`、`SystemSoftTaskCandidate`、`ProfileExplanation`、`ProofSummaryInsight` 的稳定合同，后续任务包全部复用。

**优先级：** P0

**依赖：** 无。应最先执行。

## 涉及文件

```text
docs/superpowers/specs/2026-05-21-action-review-profile-contract.md
lib/server/action-review/types.ts
tests/server/action-review/action-review-fixtures.test.ts
tests/fixtures/action-review/*.json
```

如果当前 repo 还没有 `lib/server/action-review/` 或 `tests/server/action-review/`，本包负责创建目录。

## 必须定义的核心类型

```ts
type RhythmWindowDays = 7 | 14 | 30 | 90;

type ProfileMode =
  | "default"
  | "explicit-user-choice"
  | "candidate"
  | "active";

type ProfileDimensionValue = "unknown" | "low" | "medium" | "high";

type PolicyAppliesTo =
  | "future-planning-only"
  | "future-reminders-only"
  | "experiment";

type SystemSoftTaskSource =
  | "profile"
  | "proof-summary"
  | "recovery"
  | "continuation";
```

必须包含这些对象：

```text
ProofEventRef
ReminderAuditRef
ProofSignalAggregate
ProfileSnapshot
ProfileDimension
AgentPolicySnapshot
SystemSoftTaskCandidate
ProfileExplanation
ProofSummaryInsight
ProfileGovernanceSettings
```

## 禁止出现在输出类型里的字段

第三层输出类型不能包含这些权威写入对象：

```text
committedDeck
cardMutation
reminderJob
proofAppend
deadlineMutation
hardLockMutation
timeLockMove
baselineGoalReduction
standardGoalReduction
```

如果测试或文档需要提到这些词，只能作为 forbidden output 或 red-team case。

## 必须准备的 fixtures

```text
empty-proof-default-profile.json
completed-deck-proof-events.json
frozen-then-resumed-proof-events.json
burn-then-completed-proof-events.json
reminder-delivered-and-responded.json
reminder-delivery-failed.json
notification-permission-missing.json
personalization-disabled.json
candidate-profile-low-confidence.json
static-policy-default-balanced.json
```

## 合同测试重点

- 默认 `ProfileSnapshot` 所有维度必须为 `unknown`。
- 默认 `ProfileSnapshot.confidence` 必须为 `0`。
- `AgentPolicySnapshot.appliesTo` 必须是 future-facing 或 experiment。
- `SystemSoftTaskCandidate.defaultTension` 必须固定为 `soft`。
- `SystemSoftTaskCandidate.requiresTimeGuardianReview` 必须为 `true`。
- fixture 不能表达 deck/card/reminder/proof/deadline/hard lock 直接写入。
- personalization disabled fixture 不能产生 active inferred profile。

## 验收标准

- 类型层面能表达 read proof -> aggregate -> profile -> policy -> candidate/explanation。
- 类型层面不能表达第三层直接 mutation。
- fixture 覆盖空数据、完成、冻结、燃烧、提醒送达、提醒失败、无权限、禁用个性化。
- 测试能扫描 fixture 并验证字段完整性和禁止字段。

## 验证命令

```powershell
pnpm test tests/server/action-review/action-review-fixtures.test.ts
pnpm typecheck
```

如果当前项目没有 `typecheck` 脚本，改用：

```powershell
pnpm exec tsc --noEmit --incremental false
```

## 建议提交

```powershell
git add docs/superpowers/specs/2026-05-21-action-review-profile-contract.md lib/server/action-review/types.ts tests/server/action-review tests/fixtures/action-review
git commit -m "docs: define action review profile contracts"
```

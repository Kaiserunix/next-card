# 任务包 D：Explanation Builder 与 Proof Summary Insight 包

> **执行要求：** 本包只生成用户可见支持性解释和 proof summary insight。不要暴露 agent 分层，不要输出诊断、评分、羞辱性标签。

**目标：** 让未来计划或卡片的轻微调整有温和、可信、可解释的文案，同时支持 proof summary 的行动回顾。

**优先级：** P1

**依赖：** A、C。可与 G 并行。

## 涉及文件

```text
lib/server/action-review/explanation-builder.ts
lib/server/action-review/proof-summary-insight.ts
tests/server/action-review/explanation-builder.test.ts
tests/server/action-review/proof-summary-insight.test.ts
```

## 必须实现的接口

```ts
buildProfileExplanation(policy): ProfileExplanation
buildProofSummaryInsight(aggregate, profile, policy): ProofSummaryInsight
```

## 允许文案方向

```text
这次先给你一张更短的启动卡。
这个任务会多留一点缓冲时间。
这张卡适合先恢复上下文，再继续。
这次提醒会轻一点，只保留关键节点。
今天的证据显示，短卡片更适合作为开头。
```

## 禁止文案和概念

禁止出现：

```text
懒
拖延症
自律差
执行力评分
人格画像
能力评估
失败
惩罚
低纪律
low discipline
lazy
personality score
procrastination disorder
```

## 输出边界

`ProfileExplanation` 和 `ProofSummaryInsight` 只能解释：

```text
future planning hint
future reminder tone
future first-step size
future buffer preference
proof summary pattern
```

不能解释或暗示：

```text
deadline was changed by profile
hard lock was moved by profile
proof was scored morally
user was diagnosed
active deck was rewritten
```

## 验收标准

- 文案不暴露 agent 名称、agent 层级或 agent 对话。
- 文案不使用禁止词。
- insight 是行动回顾，不是心理判断。
- 空数据时输出中性说明，而不是推断用户习惯。
- 所有 explanation 都可被 UI 直接展示。

## 验证命令

```powershell
pnpm test tests/server/action-review/explanation-builder.test.ts tests/server/action-review/proof-summary-insight.test.ts
pnpm typecheck
```

如果当前项目没有 `typecheck` 脚本，改用：

```powershell
pnpm exec tsc --noEmit --incremental false
```

## 建议提交

```powershell
git add lib/server/action-review/explanation-builder.ts lib/server/action-review/proof-summary-insight.ts tests/server/action-review
git commit -m "feat: add neutral action review explanations"
```

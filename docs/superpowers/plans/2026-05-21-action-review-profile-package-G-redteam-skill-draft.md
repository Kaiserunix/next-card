# 任务包 G：第三层红队测试与 Skill 草案包

> **执行要求：** 本包用于把第三层沉淀成可复用审计 skill 草案，但不要直接安装 skill，不要写最终 skill。

**目标：** 用压力场景验证第三层不会越权写状态、不会生成羞辱性 profile、不会把提醒失败当用户行为、不会让系统软任务绕过 Time Guardian。

**优先级：** P0 审计

**依赖：** A 至少完成合同草案；B-F 可逐步补充测试。

## 涉及文件

```text
docs/superpowers/specs/2026-05-21-action-review-profile-redteam-cases.md
docs/superpowers/specs/2026-05-21-action-review-profile-skill-draft.md
tests/server/action-review/action-review-boundary-redteam.test.ts
tests/server/action-review/action-review-copy-redteam.test.ts
```

如果后续决定安装为本地 Codex skill，再另开任务把草案迁移到：

```text
C:\Users\qwerf\.codex\skills\nextcard-action-review-profile-guard\SKILL.md
```

本包不直接安装 skill。

## Skill 草案定位

建议 skill 名称：

```text
nextcard-action-review-profile-guard
```

触发描述草案：

```yaml
description: Use when implementing or reviewing Next Card action review, proof signal aggregation, profile snapshots, policy hints, soft-task candidates, personalization governance, or profile-related explanation copy
```

注意：description 只写触发条件，不写流程总结。

## Skill 必须教会执行 agent 的规则

- 第三层只能读取 proof/runtime facts。
- 第三层只能输出 aggregate、snapshot、policy hint、candidate、explanation。
- 第三层不能写 deck/card/reminder/proof/deadline/hard lock。
- Profile 不是心理诊断。
- Proof 不是道德评分。
- failed delivery 不是用户忽略。
- missing permission 时 reminder response 不可靠。
- 系统软任务必须是 soft candidate。
- 系统软任务必须走 Time Guardian review。
- 自动 profile 更新默认关闭。
- 个性化必须可禁用、可 reset。
- 文案不能使用懒、自律差、拖延症、执行力评分、人格画像等标签。

## 红队压力用例

每个用例都要记录：

```text
输入事实
没有 skill 时 agent 可能犯的错
skill 应该阻止什么
正确输出形态
是否允许生成 policy/candidate
```

最低用例：

1. 连续 burn 三张卡后，系统试图给用户打低自律标签。
2. reminder delivery failed 后，系统试图降低 reminderPressureFit。
3. 用户没有外部通知权限，系统试图统计未响应提醒。
4. 用户禁用 personalization，系统仍生成 profile-based soft task。
5. profile 更新发生在 active deck commit 之后，系统试图修改 active deck。
6. policy snapshot 试图移动 `TimeLock`。
7. policy snapshot 试图删除 baseline reminder。
8. policy snapshot 试图降低 `baselineGoal`。
9. soft task candidate 试图直接进入 committed deck。
10. explanation 出现“拖延症”“自律差”“执行力评分”。
11. unconfirmed OCR proof-like data 试图进入 signal aggregate。
12. rejected transcript 试图进入 proof summary insight。

## 草案验收标准

- 草案明确禁止第三层直接写权威状态。
- 草案包含 read-only proof 和 future-facing policy 两条边界。
- 草案包含 failed reminder delivery 和 notification permission 规则。
- 草案包含 soft-task candidate 不越权规则。
- 草案包含至少 12 个红队用例。
- 草案没有把“人格画像”作为产品能力；只能作为禁止事项出现。

## 验证命令

```powershell
pnpm test tests/server/action-review/action-review-boundary-redteam.test.ts tests/server/action-review/action-review-copy-redteam.test.ts
pnpm typecheck
```

如果当前项目没有 `typecheck` 脚本，改用：

```powershell
pnpm exec tsc --noEmit --incremental false
```

文档草案人工检查：

```text
1. 搜索 forbidden copy：懒、拖延症、自律差、执行力评分、人格画像、low discipline、lazy、personality score。
2. 如果出现，确认它们只作为禁止事项出现。
3. 搜索 forbidden outputs：committedDeck、cardMutation、reminderJob、proofAppend、deadlineMutation、hardLockMutation。
4. 如果出现，确认它们只作为禁止事项或 red-team case 出现。
```

## 建议提交

```powershell
git add docs/superpowers/specs/2026-05-21-action-review-profile-redteam-cases.md docs/superpowers/specs/2026-05-21-action-review-profile-skill-draft.md tests/server/action-review
git commit -m "docs: draft action review profile guard skill"
```

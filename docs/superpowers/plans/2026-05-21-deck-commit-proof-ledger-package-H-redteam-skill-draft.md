# 任务包 H：红队测试与 Skill 草案包

> **执行要求：** 本包补齐 Deck Commit / Proof Ledger 专用红队用例、边界 skill 草案和文档收口。不要新增产品功能，不要改 UI。

**目标：** 用测试和执行提示防止未来任务绕过 authority boundary，尤其是直接写 proof、提交未选择方案、把失败提醒当用户行为、用羞辱性语言污染 proof。

**优先级：** P0 审计

**依赖：** A、B、D、E、G。

## 涉及文件

```text
docs/superpowers/specs/2026-05-21-deck-commit-proof-ledger-redteam-cases.md
docs/superpowers/specs/2026-05-21-deck-commit-proof-ledger-skill-draft.md
tests/server/deck-commit/authority-boundary-redteam.test.ts
tests/server/proof-ledger/proof-language-redteam.test.ts
tests/api/backend/deck/commit-boundary-redteam.test.ts
AGENTS.md
```

只在需要同步 P0 边界摘要时修改 `AGENTS.md`。

## 红队用例

必须覆盖：

1. PlanModeDraft 尝试直接写 `proofWritten=true`。
2. Commit request 缺 selectedPlanId，系统试图默认方案 A。
3. 用户选择 B，但 route 返回 A/C cards。
4. 用户选择 B，但 Time Guardian handoff 包含 A/C cards。
5. Deck Commit 直接 import Proof Ledger repository 并 append。
6. Proof request 伪装成 Card Runtime 完成事件。
7. Time Guardian 请求 `card_completed` proof。
8. Notification failed delivery 被写成用户忽略。
9. raw transcript 被写成 proof。
10. unconfirmed OCR 课程表被写成 proof。
11. summary 出现 `懒`、`低自律`、`拖延症`、`执行力差`、`人格评分`。
12. commit 成功但 proof append 失败时 deck 被回滚。
13. same draft 改选另一个 plan 后成功 commit。
14. public arbitrary proof write route 存在。

## Skill 草案必须包含的规则

```text
Deck Commit can write committed deck/card and proof request outbox only.
Proof Ledger alone appends proof.
Never let Plan Mode, Profile, Time Guardian, Input Layer, or Deck Commit fabricate completion proof.
Never default to plan-a.
Never write unchosen options into deck/card/proof/time-guardian refs.
Never treat failed reminder delivery as user behavior.
Never use shame, diagnosis, discipline score, or morality language in proof.
```

## 文档收口

需要检查并同步：

- `AGENTS.md` 是否提到 Deck Commit / Proof Ledger P0 边界。
- `docs/superpowers/specs/2026-05-21-deck-commit-proof-ledger-boundary.md` 是否仍然与实现任务一致。
- `docs/superpowers/plans/2026-05-21-deck-commit-proof-ledger-execution-index.md` 是否链接所有 A-H 包。

## 测试重点

- 所有红队用例都失败在 validator、route 或 proof ledger boundary。
- 文案红队覆盖中文羞辱和诊断词。
- route 搜索证明没有 public arbitrary proof write endpoint。
- 序列化 response 不包含 unchosen option cards。

## 验收标准

- 红队测试可单独运行。
- skill 草案能给后续 Codex/agent 使用。
- AGENTS 边界摘要清晰，不覆盖现有 voice、Plan Mode、Time Guardian 合同。
- 没有引入 UI 改动。

## 验证命令

```powershell
pnpm test tests/server/deck-commit/authority-boundary-redteam.test.ts tests/server/proof-ledger/proof-language-redteam.test.ts tests/api/backend/deck/commit-boundary-redteam.test.ts
pnpm typecheck
pnpm lint
```

## 建议提交

```powershell
git add docs/superpowers/specs/2026-05-21-deck-commit-proof-ledger-redteam-cases.md docs/superpowers/specs/2026-05-21-deck-commit-proof-ledger-skill-draft.md tests/server/deck-commit/authority-boundary-redteam.test.ts tests/server/proof-ledger/proof-language-redteam.test.ts tests/api/backend/deck/commit-boundary-redteam.test.ts AGENTS.md
git commit -m "test: add deck commit proof ledger redteam coverage"
```

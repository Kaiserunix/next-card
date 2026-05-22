# 任务包 G：Regeneration、红队与实现文档收口包

> **执行要求：** 本包补齐 regenerate 行为、红队文档、README/backend boundary 同步。不要实现 Deck Commit Service。

**目标：** 确保 `否，重新生成` 使用同一 handoff 生成新 draft，并把 plan-mode 边界写入文档和审计用例。

**优先级：** P1

**依赖：** A-F

## 涉及文件

```text
tests/server/plan-mode/plan-mode-regeneration.test.ts
docs/superpowers/specs/2026-05-21-post-voice-plan-mode-redteam-cases.md
docs/backend-extension-boundaries.md
README.md
```

如果 `README.md` 当前正处于前端重构冲突状态，执行者可以只更新 `docs/backend-extension-boundaries.md`，并在最终报告里记录 README blocker。

## Regeneration 行为

`operation="regenerate"` 必须：

- require `previousPlanModeDraftId`。
- use same `PlanCompilerHandoff`。
- create new `PlanModeDraft.id`。
- preserve `previousPlanModeDraftId`。
- allow `regenerateHint`。
- still output exactly A/B/C。
- not mutate previous draft。
- not commit deck。

## 红队用例

最低覆盖：

1. 用户点击重新生成，但服务复用了旧 draft id。
2. regenerate 丢失 original handoff，改用 raw transcript。
3. provider 返回四个方案。
4. provider 返回两个方案。
5. provider 在 response 中选择方案 A。
6. provider 返回 `deckCommitted=true`。
7. provider 返回 broad card。
8. voice-confirmed 请求没有 confirmed transcript id。
9. multimodal handoff missing nonblocking facts 时 provider 自行发明地点。
10. route import 了 proof/reminder/time-guardian writer。

## 文档同步要求

`docs/backend-extension-boundaries.md` 应说明：

```text
POST /api/backend/plan-mode
```

的职责是：

- receive PlanCompilerHandoff,
- produce PlanModeDraft,
- persist draft for regeneration/future commit reference,
- never commit deck,
- never write proof,
- never create reminders,
- never schedule cards.

README 如可更新，应加入最小后端路线：

```text
voice confirm -> input-layer handoff -> plan-mode draft -> future deck commit
```

## 验收标准

- regeneration 测试通过。
- 红队用例文档覆盖 route/service/provider 越权风险。
- backend boundary 文档不再把 plan-mode 描述成 deck commit。
- README 或最终报告明确当前 deck commit 仍是 future boundary。

## 验证命令

```powershell
pnpm test tests/server/plan-mode/plan-mode-regeneration.test.ts tests/server/plan-mode/plan-mode-boundary-redteam.test.ts
pnpm typecheck
pnpm lint
```

## 建议提交

```powershell
git add tests/server/plan-mode docs/superpowers/specs/2026-05-21-post-voice-plan-mode-redteam-cases.md docs/backend-extension-boundaries.md README.md
git commit -m "test: harden plan mode regeneration boundaries"
```

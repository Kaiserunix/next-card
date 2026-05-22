# A：Strict Review 确认续跑包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 让 strict/light import review 的结果可以被用户确认、修正或拒绝，然后继续进入 Plan Mode handoff，而不是停在一次性 report。

**Architecture:** Import Review 只保存 pending review session 和候选事实。确认动作由 deterministic `ImportConfirmationService` 处理，输出 `VerifiedInputBundle` / `PlanCompilerHandoff`，不 commit deck、不写 proof、不设置提醒。

**Tech Stack:** TypeScript, Vitest, Next.js route handlers, local JSON repositories under `.nextcard-data`.

---

## 目标

当前 `POST /api/backend/import` 能产生 `ImportReviewReport`，但 strict review 后缺少正式“用户确认事实 -> 继续 Plan Mode”的 route/service。P0 需要补齐这个续跑点，让图片课表、通知、PDF/DOCX 抽取后的时间、地点、事件、生命周期可以被确认或修正。

## 文件

- Create: `lib/server/import-review/confirmation-session-repository.ts`
- Create: `lib/server/import-review/import-confirmation-service.ts`
- Modify: `lib/server/import-review/import-review-service.ts`
- Modify: `lib/server/import-review/types.ts`
- Create: `app/api/backend/import/confirm/route.ts`
- Test: `tests/server/import-review/import-confirmation-service.test.ts`
- Test: `tests/api/backend/import/confirm-route.test.ts`

## API 草案

```text
POST /api/backend/import
-> ImportReviewReport {
  reportId,
  reviewSessionId,
  reviewGate,
  extraction,
  canProceedToPlanMode,
  planCompilerHandoff?
}

POST /api/backend/import/confirm
{
  reviewSessionId,
  action: "confirm" | "correct" | "reject",
  corrections?: {
    facts?: Array<{ factId: string; value: string }>,
    missingFacts?: Record<string, string>
  },
  clientContext?: { now, timezone, locale, anonymousDeviceId, userId }
}
-> {
  status: "confirmed" | "corrected" | "rejected",
  verifiedInputBundle?,
  planCompilerHandoff?,
  boundaryWarnings,
  errors
}
```

## 步骤

- [ ] 写 confirmation session 类型：保存 `rawInputId`、`sourceType`、`extraction`、`confirmationRequest`、`createdAt`、`expiresAt`。
- [ ] 实现 JSON repository，默认写 `.nextcard-data/import-review-sessions.json`。
- [ ] 修改 `ImportReviewService`：当 review 不是 blocked 时创建 `reviewSessionId`；light review 可继续返回 handoff，但仍保留 session。
- [ ] 实现 `ImportConfirmationService.confirm()`：confirm/correct 走 `confirmFacts()`，reject 只关闭 session。
- [ ] 校验 corrections：不得改 `rawInputId`、不得伪造不存在的 factId、不得让 high-risk source 无证据直接变 hard lock。
- [ ] 实现 route，并清理错误信息中的 token/data URL。
- [ ] 写测试：strict image 首次不能进入 Plan Mode，confirm 后能产生 handoff。
- [ ] 写测试：修正地点/时间后 handoff 使用 corrected value，并保留 evidenceRefs。
- [ ] 写测试：reject 后不能继续 Plan Mode。
- [ ] 写红队：prompt injection source 文本不能通过 correction 变成系统指令或 proof。

## 验收

```powershell
pnpm test tests/server/import-review tests/api/backend/import
pnpm typecheck
pnpm lint
```

## 不做

- 不做前端确认 UI。
- 不自动 commit deck。
- 不写 proof。
- 不把 strict review 静默降级成 light review。

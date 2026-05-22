# F：P0 验收、红队与交接报告包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 把 A-E 的结果用测试、真实 smoke、红队用例和一份交接报告固定下来，让下一个执行/前端对话知道 P0 后端闭环的真实完成度。

**Architecture:** 验收覆盖边界，不靠“能跑一次”判断完成。报告要区分 mock、deterministic local、真实 MiMo、sandbox、正式 local JSON store。

**Tech Stack:** Vitest, Markdown reports, real MiMo CLI smoke.

---

## 目标

P0 完成后必须留下可复现证据：哪些 route 可用、哪些服务是权威状态、哪些仍是 sandbox/mock、哪些真实 MiMo 已跑过。不要只说“完成了”。

## 文件

- Create: `docs/superpowers/specs/2026-05-22-p0-usable-backend-closure-report.md`
- Create or Modify: `docs/superpowers/specs/2026-05-22-p0-redteam-cases.md`
- Modify: `docs/real-mimo-test-service.md` if CLI usage changed
- Modify: `README.md` only if scripts/routes changed and current README references stale commands
- Test: `tests/server/p0-backend-boundary-redteam.test.ts`

## 红队清单

- [ ] strict image 未确认时不得进入 Plan Mode。
- [ ] strict image 经确认后才可进入 Plan Mode。
- [ ] notification “明天交”缺 source timestamp 时必须 review。
- [ ] PDF/DOCX prompt injection 不得写 deck/proof/reminder。
- [ ] 用户未选择 option 时不得 commit。
- [ ] 用户选择 B 时不得 schedule A/C。
- [ ] Card Runtime 以外的 `card_completed` proof 必须被拒绝。
- [ ] Freeze 不删除 deck/card，只进入恢复/重排路径。
- [ ] Burn 不被标成失败、惩罚或人格判断。
- [ ] 无通知权限时不得声称 external reminder 已设置。
- [ ] Proof Timeline route 只读，不能 append proof。
- [ ] report/export 不含 `MIMO_API_KEY`、Bearer token、data URL 原文。

## 报告必须包含

- 当前 branch / commit。
- 已实现 routes。
- 已实现 services。
- 当前 P0 完成范围。
- 仍不做的范围：
  - production database
  - external notification delivery
  - calendar sync
  - full frontend UI
  - OCR PDF/table reconstruction
- 验证命令和结果。
- 真实 MiMo smoke 结果：
  - text 1 case
  - image 1 case
- 可选小批量 image 5 case
- 新对话启动提示。

## 步骤

- [ ] 先跑 A-E 的 package-specific tests，记录失败项并回到对应包修。
- [ ] 写 `tests/server/p0-backend-boundary-redteam.test.ts`，覆盖上方红队清单。
- [ ] 跑全量 `pnpm test`，确认新增测试没有依赖本地 runtime artifact。
- [ ] 跑 `pnpm typecheck`、`pnpm lint`、`pnpm build`。
- [ ] 跑最小真实 MiMo text smoke，记录 model、parsed、sufficiency、options。
- [ ] 跑最小真实 MiMo image smoke，记录 sourceKind、needsStrictReview、events/times/locations。
- [ ] 确认 `.nextcard-data` 没有被提交，route/report/export 不含 token/data URL。
- [ ] 写 P0 closure report，明确“完成 / 未做 / 仍是 sandbox / 仍是 mock”。
- [ ] 更新 `docs/real-mimo-test-service.md` 或 README 中受影响的命令。
- [ ] 最后跑 `git status --short`，报告未提交文件或已提交 commit。

## 验收命令

```powershell
pnpm test tests/server/import-review tests/api/backend/import
pnpm test tests/server/card-runtime tests/api/backend/card
pnpm test tests/server/proof-ledger tests/api/backend/proof
pnpm test tests/server/backend-orchestrator tests/api/backend/sandbox
pnpm test tests/server/p0-backend-boundary-redteam.test.ts
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm real:mimo -- --mode text --limit 1
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

## 不做

- 不要求跑完整 55 张图片作为默认验收。
- 不提交 `.nextcard-data`。
- 不创建网页平台。
- 不声明 production-ready。

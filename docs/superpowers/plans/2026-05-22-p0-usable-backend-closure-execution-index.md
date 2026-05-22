# Next Card P0 可用后端闭环执行包索引

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement these packages task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking inside each package.

**Goal:** 把当前已通过测试的后端/MiMo 基础推进到“可内部真实使用、可 CLI/API 跑完整链路”的 P0 闭环。

**Architecture:** 保持 hidden runtime 边界：模型只产出候选/草案，权威状态由 deterministic services 写入。P0 目标不是重建网页平台，也不是生产化数据库，而是补齐 strict review 后续、Card Runtime、Proof Timeline、可压测的 sandbox 链路，以及 PDF/DOCX 最小文本抽取。

**Tech Stack:** Next.js App Router route handlers, TypeScript, Vitest, local JSON stores under `.nextcard-data`, MiMo OpenAI-compatible API.

---

## 当前基线

本索引建立在以下当前状态之上：

- `docs/superpowers/plans/2026-05-22-backend-mimo-completion-execution-index.md` 的 A-F 已落地。
- `POST /api/backend/import` 已能跑 text/image import review。
- `MimoMultimodalExtractor` 已接入图片链路。
- `POST /api/backend/plan-mode` 已生成 A/B/C。
- `POST /api/backend/deck/commit` 已提交用户选择的单个 option。
- `POST /api/backend/sandbox/run` 已能跑 text sandbox 链路。
- `ProofLedger` 已是 append-only writer。
- 当前验证基线：`pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm build` 通过。
- 当前真实 smoke 基线：`pnpm real:mimo -- --mode text --limit 1` 和单张图片 smoke 通过。

## P0 完成定义

完成后，执行者应能在没有网页平台的情况下，用 API/CLI 证明：

```text
真实 text / image / notification / pdf / docx 输入
-> Import Review
-> strict/light fact confirmation
-> Plan Mode A/B/C
-> selected option Deck Commit
-> Card Runtime actions
-> Time Guardian queue actions
-> Proof Ledger append
-> Proof Timeline projection
```

其中：

- strict review 不得自动进入 Plan Mode，必须确认或修正核心事实。
- 只有用户选择的 A/B/C option 可以 commit 和 schedule。
- `card_completed` 只能由 Card Runtime 写入 proof request。
- Proof Timeline 是读取/投影，不提供任意 proof 写入口。
- PDF/DOCX P0 只承诺服务端文本抽取；不承诺版式 OCR 和完整表格理解。
- Sandbox / CLI 必须能传入复杂 `timeLocks` / `availableWindows`，用于压测 Agent2 时间线理解。

## 分包执行顺序

1. A：Strict Review 确认续跑包，P0
2. B：Card Runtime 权威动作包，P0
3. C：Proof Timeline 读取投影包，P0
4. D：Sandbox 时间线压测入口包，P0
5. E：PDF/DOCX 最小文本抽取包，P0
6. F：P0 验收、红队与交接报告包，P0 审计

## 独立任务包文件

- [A：Strict Review 确认续跑包](./2026-05-22-p0-package-A-strict-review-confirmation.md)
- [B：Card Runtime 权威动作包](./2026-05-22-p0-package-B-card-runtime-authority.md)
- [C：Proof Timeline 读取投影包](./2026-05-22-p0-package-C-proof-timeline-readmodel.md)
- [D：Sandbox 时间线压测入口包](./2026-05-22-p0-package-D-sandbox-timeline-cli.md)
- [E：PDF/DOCX 最小文本抽取包](./2026-05-22-p0-package-E-pdf-docx-text-extraction.md)
- [F：P0 验收、红队与交接报告包](./2026-05-22-p0-package-F-acceptance-redteam-handoff.md)

## 全局不变量

- 不重建 `/test-platform` 网页平台。
- 不把 hidden agent、agent 名称或 agent 对话暴露给用户。
- 不默认选择方案 A。
- 不让 import route 直接 commit deck。
- 不让 Plan Mode 直接写 deck/proof/reminder/profile。
- 不让 Time Guardian 直接 append proof。
- 不允许 Profile 改 active deck/card/reminder/proof。
- 不允许 Proof Ledger 记录羞辱性、诊断性、道德评分语言。
- 不允许没有外部通知权限时声称 external reminder 已设置。
- 不提交 `.nextcard-data` runtime artifact。
- 不把 `MIMO_API_KEY` 或 data URL 写入报告、route response、fixture export。

## 最低整体验收

```powershell
pnpm test tests/server/import-review tests/api/backend/import
pnpm test tests/server/card-runtime tests/api/backend/card
pnpm test tests/server/proof-ledger tests/api/backend/proof
pnpm test tests/server/backend-orchestrator tests/api/backend/sandbox
pnpm test tests/server/input-layer tests/server/plan-mode tests/server/time-guardian tests/server/backend-boundary-redteam.test.ts
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm real:mimo -- --mode text --limit 1
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

如果实现 D 包新增了 CLI，则还要运行：

```powershell
pnpm backend:chain -- --case strict-image-confirmed
pnpm backend:chain -- --case crowded-timeline --selected-option plan-b
```

## 分派建议

- Input/review 同事：A + E
- Runtime/state 同事：B + C
- Orchestration/testing 同事：D + F

## 给下个对话的启动提示

```text
在 C:\Users\qwerf\Desktop\nextcard 继续完成 P0 可用后端闭环。
先读：
1. AGENTS.md
2. docs/superpowers/plans/2026-05-22-p0-usable-backend-closure-execution-index.md
3. 对应的 package A-F 文件

目标不是做网页平台，而是补齐 strict review 确认续跑、Card Runtime、Proof Timeline 读取、可压测 sandbox 链路、PDF/DOCX 最小文本抽取，以及最终验收报告。
实现后必须跑 pnpm test / typecheck / lint / build，真实 MiMo smoke 只跑最小 text + image，不提交 .nextcard-data，不暴露 token。
```

## 执行者最终报告格式

```text
完成范围:
- ...

改动文件:
- ...

验证:
- ...

未做/刻意不做:
- ...

发现的产品或架构阻塞:
- ...
```

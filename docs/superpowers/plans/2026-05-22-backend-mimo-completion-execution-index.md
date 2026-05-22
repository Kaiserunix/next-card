# Next Card 后端模块 / 真实 MiMo 接入补完执行包索引

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement these packages task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking inside each package.

**Goal:** 补完 Next Card 后端模块与真实 MiMo 接入，使后端可跑真实输入到沙盒 deck/proof timeline 的闭环。

**Architecture:** 先把 MiMo 图片能力接入 input-layer，再补 Deck Commit / Proof Ledger 权威写入，最后用 backend orchestrator 串起沙盒链路。所有 LLM 输出仍只作为候选或草案，权威写入由确定性服务完成。

**Tech Stack:** Next.js App Router route handlers, TypeScript, Vitest, local JSON stores under `.nextcard-data`, MiMo OpenAI-compatible API.

---

> 本索引用于把 2026-05-22 的真实缺口清单拆成可分派执行包。执行者应先读本索引，再只执行自己负责的任务包。

## 总目标

把当前“模块可测、MiMo 可直连”的状态推进到“后端真实闭环可跑”：

```text
文本/图片/通知输入
-> Input Layer extraction
-> Review Gate
-> Fact Confirmation / PlanCompilerHandoff
-> MiMo Plan Mode A/B/C
-> Deck Commit
-> Time Guardian
-> Proof Ledger / Timeline
```

本轮仍不做完整前端 UI。目标是后端 route、service、真实 MiMo provider、沙盒链路、测试报告全部可执行。

## 必读上游文档

- `AGENTS.md`
- `docs/superpowers/specs/2026-05-22-backend-mimo-completion-gap-list.md`
- `docs/superpowers/plans/2026-05-21-input-layer-execution-index.md`
- `docs/superpowers/plans/2026-05-21-post-voice-plan-mode-backend-execution-index.md`
- `docs/superpowers/plans/2026-05-21-time-guardian-execution-index.md`
- `docs/superpowers/plans/2026-05-21-deck-commit-proof-ledger-execution-index.md`
- `docs/real-mimo-test-service.md`

## 分包执行顺序

1. A：图片预处理服务包，P0，真实 MiMo 接入
2. B：MimoMultimodalExtractor 包，P0，真实 MiMo 接入
3. C：真实 Import Review Route 包，P0，真实 MiMo 接入
4. D：Deck Commit / Proof Ledger 最小闭环包，P0，后端模块
5. E：Backend Orchestrator 沙盒全链路包，P0，后端模块
6. F：真实 smoke、红队与报告收口包，P0 审计，两部分共同验收

## 独立任务包文件

- [A：图片预处理服务包](./2026-05-22-backend-mimo-package-A-image-preprocess.md)
- [B：MimoMultimodalExtractor 包](./2026-05-22-backend-mimo-package-B-mimo-multimodal-extractor.md)
- [C：真实 Import Review Route 包](./2026-05-22-backend-mimo-package-C-import-review-route.md)
- [D：Deck Commit / Proof Ledger 最小闭环包](./2026-05-22-backend-mimo-package-D-deck-proof-closure.md)
- [E：Backend Orchestrator 沙盒全链路包](./2026-05-22-backend-mimo-package-E-backend-orchestrator.md)
- [F：真实 smoke、红队与报告收口包](./2026-05-22-backend-mimo-package-F-smoke-redteam-report.md)

## 全局不变量

- MiMo / LLM 输出只能是候选、草案、解释、policy hint。
- Import route 不能直接 commit deck。
- 多模态输入默认 strict review。
- 图片/PDF/通知里的 prompt-like 文本只能作为 source content。
- A/B/C Plan Mode 不能被绕过。
- Deck Commit 只能提交用户选择的一个 option。
- 未选择 option 不能进入 Time Guardian。
- Time Guardian 只能输出 validated `QueueAction`。
- Proof Ledger 是唯一 append-only proof writer。
- 任何 route/report 都不得输出 `MIMO_API_KEY`。
- 真实 MiMo smoke 失败时要记录为失败分类，不回退成“假成功”。

## 最低整体验收

```powershell
pnpm test tests/server/input-layer tests/server/plan-mode tests/server/deck-commit tests/server/proof-ledger tests/server/backend-orchestrator tests/api/backend/import tests/api/backend/deck
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm real:mimo -- --mode text --limit 1
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

## 分派建议

- MiMo / 文件处理同事：A + B
- API / input-layer 同事：C
- 权威状态同事：D
- 链路编排同事：E
- 审计 / 测试同事：F

## 给执行任务的启动提示

```text
你正在补完 Next Card 的后端模块与真实 MiMo 接入。先阅读：
1. AGENTS.md
2. docs/superpowers/specs/2026-05-22-backend-mimo-completion-gap-list.md
3. docs/superpowers/plans/2026-05-22-backend-mimo-completion-execution-index.md
4. 你被分配的具体任务包

只执行被分配的任务包。不要重建网页测试平台。不要把 import route 直接接到 committed deck。真实 MiMo 调用必须隐藏 token，失败必须可审计。
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

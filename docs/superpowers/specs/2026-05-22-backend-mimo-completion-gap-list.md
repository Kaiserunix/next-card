# Next Card 后端模块 / 真实 MiMo 接入未完成待补清单

> 日期：2026-05-22
> 范围：只审查两块：后端模块、真实 MiMo 接入。本文不把前端 UI 完成度算入本轮目标。

## 0. 当前真实状态

### 已经存在

- `app/api/backend/voice/*`
  - `confirm`
  - `normalize`
  - `readiness`
  - `transcribe`
- `app/api/backend/plan-mode/route.ts`
- `lib/server/input-layer/*`
- `lib/server/plan-mode/*`
- `lib/server/time-guardian/*`
- `lib/server/action-review/*`
- `lib/server/mimo-openai-client.ts`
- `scripts/real-mimo-test-service.mjs`
- `docs/real-mimo-test-service.md`
- 测试覆盖：
  - `tests/server/input-layer/*`
  - `tests/server/plan-mode/*`
  - `tests/server/time-guardian/*`
  - `tests/server/action-review/*`
  - `tests/server/stress/agent1-agent2-stress-corpus.test.ts`
  - `tests/scripts/real-mimo-test-service.test.ts`

### 明确不存在或未正式接入

- 没有正式 `app/api/backend/input/*` 或 `app/api/backend/import/*` 路由。
- 没有正式 `MimoMultimodalExtractor` 接入 `lib/server/input-layer`。
- 没有正式 `Deck Commit Service` 实现目录：
  - `lib/server/deck-commit/*`
  - `app/api/backend/deck/commit/route.ts`
- 没有正式 `Proof Ledger` 实现目录：
  - `lib/server/proof-ledger/*`
  - `app/api/backend/proof/*`
- 没有正式“输入 -> 事实确认 -> Plan Mode -> 选择方案 -> Deck Commit -> Time Guardian -> Proof Timeline”的后端编排路由。
- 没有真实图片/PDF/DOCX import API；图片 MiMo 目前只通过 CLI 测试服务直连。
- 没有正式 route-level real MiMo multimodal smoke。

---

## 1. 后端模块未完成清单

### P0-Backend-1：权威写入层缺失

现状：

- 已有 Plan Mode draft。
- 已有 Time Guardian 能消费 `CommittedDeckRef`。
- 但中间缺少真实 `Deck Commit`。

缺口：

- `PlanModeDraft + selectedPlanId -> CommittedDeck/CommittedCard[]`
- 只允许用户选择的 A/B/C 一个 option 被 commit。
- 未选择 option 不能进入 Time Guardian。
- commit 必须幂等。
- commit 不能直接 append proof，只能生成 proof request/outbox。

完成定义：

- 新增 `lib/server/deck-commit/*`。
- 新增 `app/api/backend/deck/commit/route.ts`。
- 新增 `tests/server/deck-commit/*` 和 `tests/api/backend/deck/commit-route.test.ts`。

### P0-Backend-2：Proof Ledger 权威层缺失

现状：

- `action-review` 可以读 proof-like fixtures。
- `simulation` 里有 proof timeline 概念。
- 但没有 append-only `ProofLedger` 权威服务。

缺口：

- `ProofEventRequest -> ProofEvent`
- append-only JSON repository
- proof event validator
- proof projection/timeline
- 拒绝羞辱性语言、心理诊断、伪造 card completion。

完成定义：

- 新增 `lib/server/proof-ledger/*`。
- proof 只能由 `ProofLedger` append。
- deck commit 只写 outbox，不直接写 ledger。
- Time Guardian 只能请求 deadline/soft-task/freeze 类 proof，不能请求 `card_completed`。

### P0-Backend-3：后端链路编排缺失

现状：

- 单个服务分别可测。
- 没有 route/service 把它们串成真实沙盒链路。

缺口：

```text
RawInput
-> Extraction
-> ReviewGate
-> FactConfirmation
-> PlanCompilerHandoff
-> PlanModeDraft
-> CommitDeckRequest
-> CommittedDeck
-> TimeGuardianDeckHandoff
-> QueueAction[]
-> ProofTimeline
```

完成定义：

- 新增 `lib/server/backend-orchestrator/*` 或同等目录。
- 新增沙盒链路 route，例如 `app/api/backend/sandbox/run/route.ts`。
- route 只用于测试/内测，不污染正式 stores。
- 输出完整 `BackendRunReport`。

### P0-Backend-4：Time Guardian 缺少正式入口

现状：

- `lib/server/time-guardian/*` 已有核心算法。
- 但没有从 committed deck 触发的正式 route/service。

缺口：

- `CommittedDeckRef -> scheduleCommittedDeck -> QueueAction[]`
- baseline reminder plan 汇总
- deadline warning 汇总
- soft-task tension 汇总
- freeze return queue 汇总

完成定义：

- Time Guardian 有统一 service facade。
- Deck Commit 后能生成 `TimeGuardianRunResult`。
- 所有 schedule mutation 均为 validated `QueueAction`。

### P1-Backend-5：Action Review/Profile 缺少正式消费入口

现状：

- 第三层服务和测试存在。
- MVP 可以保持静态/unknown profile。

缺口：

- `ProofLedger -> ProfileSnapshot -> AgentPolicySnapshot`
- 用户 opt-out / reset 与后续计划读取 policy。

完成定义：

- 不阻塞 P0 闭环。
- P1 增加 route/service，默认不自动改 active deck。

---

## 2. 真实 MiMo 接入未完成清单

### P0-MiMo-1：多模态 provider 还没进入 input-layer

现状：

- `MimoOpenAIClient` 已存在。
- Plan Mode provider 已能用 MiMo。
- 图片 MiMo CLI smoke 已能跑。
- input-layer 仍只有 `MockMultimodalExtractor`。

缺口：

- `MimoMultimodalExtractor implements MultimodalExtractionPort`
- 图片用 `mimo-v2.5`
- 输出 `InputExtractionResult`
- 保留 evidence / warnings / strict review
- prompt-like source text 只能作为 source content

完成定义：

- 新增 `lib/server/input-layer/mimo-multimodal-extractor.ts`。
- `MimoMultimodalExtractor` 不写 deck/proof/reminder/profile。
- 对高风险图片默认 `reviewRequirement: "strict"`。

### P0-MiMo-2：图片预处理没有成为后端能力

现状：

- `scripts/real-mimo-test-service.mjs` 已能压缩生成 PNG 再发 MiMo。
- 这还只是 CLI 能力。

缺口：

- 服务端可复用图片预处理模块。
- 大 PNG 自动压缩、转 JPEG、限制长边、限制 bytes。
- 失败时返回可恢复 review 状态，而不是假装识别成功。

完成定义：

- 新增 `lib/server/mimo/image-preprocess.ts` 或同等模块。
- CLI 和 route 共用同一预处理逻辑。
- 大图超时率下降，事件里记录 `originalBytes/sentBytes/resized`。

### P0-MiMo-3：真实 import route 缺失

现状：

- 没有 `POST /api/backend/import/real-run` 或同等 route。
- 真实图片只能用 CLI。

缺口：

- 接收 `FormData`：
  - `sourceType`
  - `text`
  - `file`
  - `clientContext`
- 跑真实 MiMo extraction。
- 跑 Review Gate。
- 输出 `ImportReviewReport`。
- 不直接进入 committed deck。

完成定义：

- 新增 `app/api/backend/import/route.ts`。
- route 输出只到 `FactConfirmationRequest` 或 `PlanCompilerHandoff`。
- 大输入不能绕过 review。

### P0-MiMo-4：MiMo 输出校验不够硬

现状：

- Plan Mode 有 validator。
- 多模态 MiMo 输出目前 CLI 只做 JSON parse 和摘要。

缺口：

- 多模态 provider 输出 schema validator。
- 防止模型漏掉 `needsStrictReview`。
- 防止把文档指令当系统指令。
- 防止直接返回 committed deck/reminder/proof。

完成定义：

- 新增 `lib/server/input-layer/mimo-extraction-validator.ts`。
- 失败 fallback 到 recoverable review state。

### P1-MiMo-5：PDF/DOCX 真实文本抽取缺失

现状：

- 规划里说 PDF/DOCX 先抽文本再交 MiMo。
- 当前代码未见正式文件抽取 route/provider。

缺口：

- PDF text extraction
- DOCX text extraction
- extraction failure 的用户可恢复状态
- evidence page/paragraph summary

完成定义：

- P1 实现。
- 不阻塞图片课表 P0。

### P1-MiMo-6：批量真实 MiMo 报告还不够产品化

现状：

- CLI 可以慢跑并写 report。

缺口：

- 汇总每张图片的识别类型、事件数量、时间数量、地点数量、warnings。
- 输出失败分类：
  - timeout
  - non-json
  - empty-content
  - schema-invalid
  - low-confidence
- 可转换为回归 fixture。

完成定义：

- `pnpm real:mimo -- --summarize latest`
- `pnpm real:mimo -- --export-fixtures latest`

---

## 3. 两部分做完的真实判定

### 后端模块完成判定

```text
POST /api/backend/plan-mode
-> POST /api/backend/deck/commit
-> Time Guardian service
-> Proof outbox
-> Proof Ledger append
-> proof timeline projection
```

最低测试：

```powershell
pnpm test tests/server/deck-commit tests/server/proof-ledger tests/server/backend-orchestrator tests/api/backend/deck tests/api/backend/import
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

### 真实 MiMo 接入完成判定

```text
POST /api/backend/import
-> image preprocess
-> MimoMultimodalExtractor
-> validated InputExtractionResult
-> Review Gate
-> FactConfirmationRequest
```

最低真实 smoke：

```powershell
pnpm real:mimo -- --mode text --limit 1
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
pnpm real:mimo -- --mode image --image-dir "C:\Users\qwerf\.codex\generated_images\019e4957-65a1-7460-b2ae-a705d832703d" --limit 5 --delay-ms 1500 --timeout-ms 180000
```

route-level smoke：

```powershell
pnpm exec next dev -H 127.0.0.1 -p 3022
pnpm real:mimo -- --mode route --route-url "http://127.0.0.1:3022/api/backend/plan-mode" --limit 1
```

---

## 4. 当前建议优先级

1. P0-MiMo-2：把图片预处理从 CLI 抽成可复用服务。
2. P0-MiMo-1：实现 `MimoMultimodalExtractor`。
3. P0-MiMo-3：实现真实 import route 到 Review Gate。
4. P0-Backend-1/2：实现 Deck Commit + Proof Ledger。
5. P0-Backend-3/4：实现后端沙盒闭环编排。
6. P1-MiMo-5/6 与 P1-Backend-5 后置。

理由：先让真实图片能进入正式 input-layer，再接 deck/proof 权威写入。这样不会把 mock 多模态结果误接成正式链路。

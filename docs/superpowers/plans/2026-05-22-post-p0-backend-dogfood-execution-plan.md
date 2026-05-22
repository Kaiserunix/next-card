# Post-P0 后端 Dogfood 执行计划

> 本文件是 `2026-05-22-post-p0-backend-dogfood-plan.md` 的执行层版本：用于告诉下个执行者“先做什么、怎么分批、每批怎么验收、什么时候可以停”。

## 0. 当前状态

当前分支已经包含 P0 后端闭包提交 `760b041 feat: complete p0 backend closure`：

- Strict Review 确认续跑
- Card Runtime
- Proof Timeline read model
- Sandbox chain / CLI
- TXT/DOCX 最小文本抽取
- P0 验收报告与红队用例

已知验证基线：

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm backend:chain -- --case text-assignment --selected-option plan-b
pnpm backend:chain -- --case crowded-timeline --selected-option plan-b
pnpm backend:chain -- --case strict-image-confirmed --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --selected-option plan-b
pnpm backend:chain -- --case notification-relative --selected-option plan-b
pnpm real:mimo -- --mode text --limit 1
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

上次结果全部通过或 OK。

## 1. 执行原则

- 不重建 `/test-platform`。
- 不做完整前端。
- 不做 production database。
- 不做外部通知真实发送。
- 不提交 `.nextcard-data`。
- 不暴露 `MIMO_API_KEY`、Bearer token、data URL。
- 不默认选择方案 A。
- 不让模型输出直接写 deck/proof/reminder/profile。
- 先修语义边界，再做 dogfood CLI。
- 每完成一组任务就跑对应 focused tests。

## 2. 推荐执行顺序

### Phase 1：修语义与报告小缺口

目标：先修不会改变大架构的小问题，降低后续 dogfood 的误导风险。

任务：

1. 修 `reminder_created` / `reminder_delivered` 语义。
2. 修 DOCX/PDF `providerUsage`。
3. 让 freeze queue action 走 `validateQueueAction()`。
4. 让 `backend:chain` 输出 mock / route provider 标识。

建议验收：

```powershell
pnpm test tests/server/proof-ledger tests/api/backend/proof
pnpm test tests/server/import-review tests/api/backend/import
pnpm test tests/server/card-runtime tests/server/time-guardian/queue-action-validator.test.ts
pnpm test tests/scripts/backend-chain-smoke.test.ts
pnpm typecheck
pnpm lint
```

阶段完成标准：

- Proof Timeline 不再把 created 说成 delivered。
- DOCX/PDF 不再被误报为 MiMo 调用。
- freeze action 有 validator 覆盖。
- `backend:chain` 输出中能看到 provider。

### Phase 2：实现极简 `backend:dogfood`

目标：提供一个真实可用的后端 dogfood 入口，让人可以不看网页平台也能跑完整链路。

最小命令：

```powershell
pnpm backend:dogfood -- --text "今晚八点前交英语作文" --selected-option plan-b --actions start,complete
```

必要输出：

```text
IMPORT_REVIEW ...
FACTS ...
PLAN_OPTIONS plan-a,plan-b,plan-c
SELECTED plan-b
CARD_ACTIONS ...
PROOF_TIMELINE ...
REPORT <path>
```

实现范围：

- 新增 `scripts/backend-dogfood.mjs`
- 新增 `backend:dogfood` script
- 新增 `tests/scripts/backend-dogfood.test.ts`
- 更新 README 的开发者 dogfood 用法

建议验收：

```powershell
pnpm test tests/scripts/backend-dogfood.test.ts
pnpm backend:dogfood -- --text "今晚八点前交英语作文" --selected-option plan-b --actions start,complete
pnpm typecheck
pnpm lint
```

阶段完成标准：

- CLI 能生成 report。
- report 里有 selected option、committed deck、runtime action、proof timeline。
- 输出明确这是 backend dogfood，不是最终用户 UI。

### Phase 3：回归与报告收口

目标：证明小修和 dogfood 没破坏已有 P0 后端闭包。

必须运行：

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

必须跑 smoke：

```powershell
pnpm backend:chain -- --case text-assignment --selected-option plan-b
pnpm backend:chain -- --case crowded-timeline --selected-option plan-b
pnpm backend:chain -- --case strict-image-confirmed --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --selected-option plan-b
pnpm backend:dogfood -- --text "今晚八点前交英语作文" --selected-option plan-b --actions start,complete
```

真实 MiMo 最小 smoke：

```powershell
pnpm real:mimo -- --mode text --limit 1
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

报告文件：

```text
docs/superpowers/specs/2026-05-22-post-p0-dogfood-report.md
```

报告必须写：

- 改了哪些文件。
- 哪些测试跑了，结果是什么。
- 哪些 smoke 跑了，结果是什么。
- `.nextcard-data` 没有提交。
- 仍然不做的范围。
- 下一步建议。

## 3. 建议提交分组

如果要提交，建议分 3 个 commit，不要一个大糊团：

### Commit 1

```text
fix: tighten post-p0 backend boundary semantics
```

包含：

- reminder timeline 语义
- providerUsage
- freeze validator
- backend:chain provider 标识

### Commit 2

```text
feat: add backend dogfood CLI
```

包含：

- `scripts/backend-dogfood.mjs`
- `backend:dogfood`
- dogfood tests
- README dogfood usage

### Commit 3

```text
docs: record post-p0 backend dogfood verification
```

包含：

- dogfood report
- 更新二次 gap review 状态

## 4. 风险点

### 风险 1：把 mock chain 当成真实 MiMo

处理：

- `backend:chain` 必须打印 provider。
- 文档里明确 `real:mimo` 和 `backend:chain` 的边界。

### 风险 2：Proof Timeline 语义污染后续画像

处理：

- created 和 delivered 分开。
- 没有 delivery audit 不得写 delivered。

### 风险 3：dogfood CLI 变成新平台

处理：

- 只做文本输出和 JSON report。
- 不做 UI，不做交互设计，不做动画。

### 风险 4：提交 runtime artifact

处理：

提交前运行：

```powershell
git status --short
```

确认没有 `.nextcard-data`。

## 5. 下个对话启动提示词

```text
在 C:\Users\qwerf\Desktop\nextcard 执行 Post-P0 后端 dogfood 收口。

先读：
1. AGENTS.md
2. docs/superpowers/specs/2026-05-22-p0-usable-backend-closure-report.md
3. docs/superpowers/specs/2026-05-22-p0-second-backend-gap-review.md
4. docs/superpowers/plans/2026-05-22-post-p0-backend-dogfood-plan.md
5. docs/superpowers/plans/2026-05-22-post-p0-backend-dogfood-execution-plan.md

按执行计划分三阶段做：
Phase 1 修 4 个后端语义/报告小缺口：
- reminder_created 不再映射成 reminder_delivered
- DOCX/PDF providerUsage 按真实 extraction path 上报
- Card Runtime freeze action 走 validateQueueAction
- backend:chain 输出 mock / route provider 标识

Phase 2 新增极简 backend:dogfood CLI：
- pnpm backend:dogfood -- --text "今晚八点前交英语作文" --selected-option plan-b --actions start,complete
- 输出 IMPORT_REVIEW / FACTS / PLAN_OPTIONS / SELECTED / CARD_ACTIONS / PROOF_TIMELINE / REPORT

Phase 3 跑完整验收：
- pnpm test
- pnpm typecheck
- pnpm lint
- pnpm build
- pnpm backend:chain 三个 case
- pnpm backend:dogfood 一个 case
- pnpm real:mimo text/image 最小 smoke

不要重建 /test-platform。
不要做完整前端。
不要提交 .nextcard-data。
不要暴露 MIMO_API_KEY、Bearer token 或 data URL。
不要默认选择方案 A。
不要让模型输出直接写 deck/proof/reminder/profile。

最后写 docs/superpowers/specs/2026-05-22-post-p0-dogfood-report.md，并给出剩余后端缺口和下一步建议。
```

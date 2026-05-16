# 任务包 L：真实后端扩展边界包

> **执行要求：** 本包只写清未来服务接入边界，不开始接真实 OCR、OpenAI、数据库、提醒或日历。

**目标：** 明确真实后端应该从哪里接入，避免当前阶段过早引入复杂后端。

**优先级：** P2

**依赖：** 无，可与其他任务包并行

**涉及文件：**

```text
docs/backend-extension-boundaries.md
README.md
lib/page-contracts.ts
```

## 需要写清的边界

### OpenAI / Planning API

当前替代：

```text
lib/mock-ai.ts
```

未来真实接口必须返回现有领域类型：

```text
AnalysisResult
PlanOption[]
TaskFlowState
TaskDeck
```

原则：UI 不直接依赖真实 API 原始响应。

### OCR API

当前替代：

```text
InputsState.imageSchedule
InputsState.parsedText
```

未来 OCR 只应该填充：

```text
UploadedImage.parsedTimetable
inputs.parsedText
```

原则：不要新增第四个主页面。

### Backend Persistence

当前替代：

```text
localStorage key: next-card-mvp
```

未来后端同步对象：

```text
inputs
taskFlow
deck
proofs
```

原则：不要把纯 UI 状态当成服务端权威状态。

### Reminder / Calendar

当前替代：

```text
deadlineAt
suggestedStartAt
rescheduleQueue
```

未来 native/backend 只应从 card 时间字段生成提醒。

### Proof Export

当前替代：

```text
proofs.records
proofs.summaryDocument
```

未来可以做：

```text
Markdown
PDF
云端 proof archive
```

## README 需要链接

```text
docs/backend-extension-boundaries.md
```

## page-contracts 需要新增 backlog

```text
Use docs/backend-extension-boundaries.md before wiring real OCR, OpenAI, backend persistence, reminders, or calendar sync.
```

## 验收标准

- 后端同事知道哪些 mock 可以替换。
- 后端同事知道哪些产品规则不能绕过。
- README 能指向真实后端接入边界。
- 当前阶段仍不接真实服务。

## 验证命令

```bash
pnpm lint
pnpm build
```

## 建议提交

```bash
git add docs/backend-extension-boundaries.md README.md lib/page-contracts.ts
git commit -m "docs: define backend extension boundaries"
```

# 任务包 D：Planning 状态机测试包

> **执行要求：** 本包只测试 input 到 plan/deck/proof 的 store 状态流，不做 UI 自动化。

**目标：** 测住从用户输入到生成任务流、deck 和第一条 proof 的后端状态机。

**优先级：** P0

**依赖：** 任务包 C

**涉及文件：**

```text
store/useNextCardStore.ts
tests/store/planning-flow.test.ts
```

## 需要测试的 action

```text
setInputText
addMockAttachment
addMockImageSchedule
analyzeInput
finishAnalysis
regeneratePlans
selectPlan
```

## 测试场景

### 文本输入

- `setInputText("去高数课")` 后：
  - `inputs.text` 正确。
  - `sourceType` 为 `text`，或在已有附件/图片时为 `mixed`。

### mock attachment

- `addMockAttachment()` 后：
  - `attachments` 增加。
  - `parsedText` 拼入 mock 作业通知。
  - `sourceType` 为 `attachment` 或 `mixed`。

### mock image schedule

- `addMockImageSchedule()` 后：
  - `imageSchedule` 不为空。
  - `parsedText` 拼入课表识别结果。
  - `sourceType` 为 `image` 或 `mixed`。

### 分析阶段

- `analyzeInput()` 后：
  - `analysisStatus` 为 `analyzing`。
  - `analysis` 有 goalUnderstanding。
  - `plans.options` 仍为空。
  - `taskFlow` 清空。

### 方案准备完成

- `finishAnalysis()` 后：
  - `analysisStatus` 为 `ready`。
  - `plans.options` 刚好 3 个。
  - `selectedPlanId` 为空。

### 重新生成

- `regeneratePlans()` 后：
  - 原始 input 不丢。
  - options 仍为 3 个。
  - `regenerateCount` 增加。
  - `taskFlow` 清空。

### 执行方案

- `selectPlan("plan-1")` 后：
  - `selectedPlanId` 为 `plan-1`。
  - 生成 `taskFlow`。
  - 生成 deck。
  - `activeDeckId` 和 `currentCardId` 正确。
  - 写入第一条 proof record。

### 无效方案 id

- 不应生成 deck。
- 不应写 proof。
- 不应破坏现有状态。

## 验收标准

- store planning 流程可独立测试。
- `去高数课` 主场景稳定通过。
- 不依赖浏览器点击或动画。

## 验证命令

```bash
pnpm test tests/store/planning-flow.test.ts
```

## 建议提交

```bash
git add tests/store/planning-flow.test.ts
git commit -m "test: cover planning store flow"
```

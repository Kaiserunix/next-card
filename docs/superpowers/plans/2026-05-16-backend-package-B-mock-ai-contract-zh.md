# 任务包 B：Mock AI 合同测试包

> **执行要求：** 本包只测试并保护 mock AI 合同，不接真实 OCR、OpenAI API 或后端服务。

**目标：** 锁定 `lib/mock-ai.ts` 的稳定输出，避免后续 UI 调整或真实服务接入时破坏核心产品规则。

**优先级：** P0

**依赖：** 任务包 A

**涉及文件：**

```text
lib/mock-ai.ts
lib/types.ts
tests/lib/mock-ai.test.ts
```

## 需要覆盖的函数

```text
mockAnalyzeInput
mockGeneratePlanOptions
mockRegeneratePlanOptions
mockGenerateTaskFlow
mockGenerateDeckFromPlan
mockGenerateTimePlanForCard
mockUpdateCardUrgency
mockRescheduleFrozenCard
mockGenerateProofSummary
```

## 测试场景

### 课程目标：去高数课

- `mockAnalyzeInput` 能识别为课程/到课任务。
- 输出包含时间约束、课程准备、出门窗口。
- `mockGenerateDeckFromPlan` 生成 deck：
  - `coverTitle` 为 `去高数课`。
  - `coverIcon` 为 `course`。
  - 第一张卡是 near-deadline burning demo。
  - 第一张卡不是 broad goal，而是具体行动。

### 作业通知

- 输入作业/提交/截止相关文本时识别为 assignment。
- deadline 文案包含 `今晚 20:00 前`。
- 方案优先保护最低可提交版本。

### 无明确时间输入

- 不允许 deadline/window 全空。
- 应生成温和默认时间建议。

### 三方案输出

- 必须且只能有 3 个方案。
- id 必须是 `plan-1`、`plan-2`、`plan-3`。
- style 必须是 `urgent`、`balanced`、`gentle`。

### 重新生成

- 保留原始输入意图。
- plan 数量仍为 3。
- 文案体现“重新生成”后的变化。

### urgency 阈值

- 大于 20 分钟：`calm`。
- 20 到 10 分钟：`hot`。
- 3 分钟内：`burning`。
- 超时：`expired` + `crack`。

### 冻结重排

- frozen card 的 `status` 为 `frozen`。
- `damageEffect` 为 `freeze`。
- `urgencyStage` 回到 `calm`。
- `cardBackNote` 保留稍后恢复上下文。

## 验收标准

- `tests/lib/mock-ai.test.ts` 覆盖以上场景。
- mock 输出稳定，测试不依赖真实时间；需要时使用 fake timers。
- 不新增真实 API 调用。

## 验证命令

```bash
pnpm test tests/lib/mock-ai.test.ts
```

## 建议提交

```bash
git add tests/lib/mock-ai.test.ts
git commit -m "test: cover mock ai planning contract"
```

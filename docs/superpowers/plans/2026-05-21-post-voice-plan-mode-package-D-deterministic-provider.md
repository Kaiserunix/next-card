# 任务包 D：Deterministic Local Provider 包

> **执行要求：** 本包实现 deterministic-local Plan Mode provider，作为真实 provider 不可用或输出非法时的 fallback。不要接真实 Mimo/OpenAI。

**目标：** 从 `PlanCompilerHandoff` 稳定生成可执行 A/B/C 草案，保证 demo 和测试在无外部 provider 时仍可运行。

**优先级：** P0

**依赖：** A

## 涉及文件

```text
lib/server/plan-mode/deterministic-plan-provider.ts
tests/server/plan-mode/deterministic-plan-provider.test.ts
```

## 必须实现的接口

```ts
class DeterministicPlanModeProvider implements PlanModeProviderPort {
  readonly provider = "deterministic-local";
  generatePlanModeDraft(input: PlanModeProviderInput): Promise<PlanModeProviderOutput>;
}
```

## 生成规则

必须生成 exactly 3 options：

```text
plan-a / A / urgent
plan-b / B / balanced
plan-c / C / gentle
```

三种方案差异：

- A：更短、更急，先做 baseline/progress card。
- B：正常节奏，覆盖 progress + standard。
- C：低压，第一步更小，允许 soft optional card。

每个 option 至少 3 张 `ActionCardDraft`。

每张卡必须有：

```text
title
action
estimatedMinutes
objectiveLevel
timingIntent
sourceStageId
```

## 禁止生成的卡片

不能生成宽泛卡片：

```text
学习数学
完成作业
准备一下
努力推进
做任务
```

卡片必须是具体动作：

```text
打开作业要求，圈出必须提交的 3 个点。
用 10 分钟写出最低可提交版本。
整理高数课本和上次作业页。
```

## 中文优先规则

当前 demo 以中文学生场景为主。provider 输出默认中文。英文输入可保留英文关键词，但不要求完整英文规划。

## 验收标准

- provider 输出 exactly A/B/C。
- A/B/C style、id、mode 正确。
- 每个 option 至少 3 张 action cards。
- cards 不是宽泛目标。
- 输出 `writes` 全 false。
- 同一 input 输出稳定，便于 snapshot/fixture 测试。

## 验证命令

```powershell
pnpm test tests/server/plan-mode/deterministic-plan-provider.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/plan-mode/deterministic-plan-provider.ts tests/server/plan-mode/deterministic-plan-provider.test.ts
git commit -m "feat: add deterministic plan mode provider"
```

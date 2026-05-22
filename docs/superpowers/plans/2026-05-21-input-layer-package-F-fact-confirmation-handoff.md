# 任务包 F：Pre-Deck Fact Confirmation 与 Plan Handoff 包

> **执行要求：** 本包只定义用户进入卡组前的事实确认合同，以及确认后交给 Plan Compiler 的数据。它不实现最终 UI 重设计，也不 commit deck。

**目标：** 确保进入 A/B/C Plan Mode 前，用户已经确认影响 deck 的关键事实：事件、时间、地点、任务类型、生命周期、风险来源。

**优先级：** P0

**依赖：** 任务包 A、E

## 涉及文件

```text
lib/server/input-layer/fact-confirmation-service.ts
lib/server/input-layer/plan-handoff-service.ts
tests/server/input-layer/fact-confirmation-service.test.ts
tests/server/input-layer/plan-handoff-service.test.ts
```

## 小输入确认

小语音/文本输入使用轻确认卡：

```text
我理解为：
事件：去高数课
时间：明天早八
地点：未知 / 待补
类型：课程到达任务
```

用户可以：

- 确认。
- 修正字段。
- 选择 chips 补字段。
- 左滑/拒绝返回重新输入。

确认后才能进入 Plan Compiler。

## 大输入确认

课程表、PDF/Word、通知批量导入使用粗范围确认：

```text
我从课表里看到：
- 周一 8:00 高数
- 周三 10:00 英语
- 可能还有 2 条低置信课程
```

先确认粗范围，再只追问高风险或低置信事实。不要变成完整表格录入工具。

## 输出合同

确认后输出：

```ts
type ConfirmFactsResult = {
  verifiedInputBundle: VerifiedInputBundle;
  planCompilerHandoff?: PlanCompilerHandoff;
  nextAction:
    | "send-to-plan-compiler"
    | "ask-light-clarification"
    | "show-strict-review"
    | "retry-input";
};
```

## Plan Compiler Handoff 规则

- `mustGenerateABC` 必须为 `true`。
- 只交付 verified facts、constraints、assumptions、missingButNonBlocking。
- 不能携带 selected plan。
- 不能携带 committed deck。
- 不能携带 reminder job。
- 不能携带 proof event。

## 验收用例

- `去高数课` 确认后 handoff 包含 event/task type，但地点缺失可作为 non-blocking 或 chip 补全。
- `今晚八点交作文` 确认后 handoff 包含 deadline constraint。
- 课程表图片必须先进入 rough-scope，不允许直接 handoff。
- 用户修正时间后，handoff 使用用户修正值，并保留原 evidence。
- 用户拒绝确认时，不保存 verified bundle，不进入 Plan Mode。

## 验证命令

```powershell
pnpm test tests/server/input-layer/fact-confirmation-service.test.ts tests/server/input-layer/plan-handoff-service.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/input-layer/fact-confirmation-service.ts lib/server/input-layer/plan-handoff-service.ts tests/server/input-layer
git commit -m "feat: add pre-deck fact confirmation handoff"
```

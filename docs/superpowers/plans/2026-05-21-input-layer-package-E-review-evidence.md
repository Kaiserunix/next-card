# 任务包 E：Review Gate 与 Evidence Binder 包

> **执行要求：** 本包负责决定哪些候选事实可以轻确认、哪些必须 strict review、哪些要 blocked。它不负责生成计划，也不负责写入最终 deck。

**目标：** 建立第一层最关键的安全阀，防止模型误读时间、地点、课程、DDL 后静默生效。

**优先级：** P0

**依赖：** 任务包 A、C、D

## 涉及文件

```text
lib/server/input-layer/review-gate.ts
lib/server/input-layer/evidence-binder.ts
lib/server/input-layer/conflict-detector.ts
tests/server/input-layer/review-gate.test.ts
tests/server/input-layer/evidence-binder.test.ts
tests/server/input-layer/conflict-detector.test.ts
```

## Review Gate 输入输出

输入：

```ts
type ReviewGateInput = {
  rawInput: RawInput;
  extraction: InputExtractionResult;
  existingVerifiedFacts?: VerifiedInputBundle[];
};
```

输出：

```ts
type ReviewGateDecision = {
  requirement: "none" | "light" | "strict" | "blocked";
  reasons: InputWarning[];
  confirmationRequest: FactConfirmationRequest;
};
```

## strict review 触发条件

- 图片课表。
- PDF/Word 课程要求。
- 通知消息改变 deadline 或 hard lock。
- 相对日期。
- 缺 timezone。
- 冲突 deadline。
- low-confidence time。
- 表格解析。
- 考试或提交截止。
- 上课时间。
- prompt-injection-like text。
- location 影响到达时间。
- recurring vs one-off 不清楚但会影响牌库生命周期。

## light review 触发条件

- 小语音/文本输入。
- 只有轻微缺字段。
- 无 hard lock。
- 无 deadline 冲突。
- 用户可通过 chips 一步确认。

## blocked 触发条件

- 输入明显无法解析，且继续会误导用户。
- 文档存在高风险注入且 extraction 无法隔离内容。
- 关键时间候选没有 evidence 且 confidence 极低。
- 与已有 verified hard lock 冲突但没有足够 evidence 展示给用户。

## Evidence Binder 规则

- 每个 deadline/hard lock candidate 必须绑定 source evidence。
- 多个来源冲突时，confirmation request 要展示两个来源摘要。
- evidence 只证明“模型为什么这么理解”，不是证明模型一定正确。

## 验收用例

- OCR 把 `10:00` 读成 `1:00`：strict review，不能 verified。
- PDF DDL 和通知 DDL 冲突：strict review，展示双 source。
- 小输入 `今晚八点交作文`：light review。
- `下节课前提醒我` 但没有课程上下文：light clarification 或 strict review，不能发明下节课时间。
- prompt injection 文档：blocked 或 strict review，不能写 proof。

## 验证命令

```powershell
pnpm test tests/server/input-layer/review-gate.test.ts tests/server/input-layer/evidence-binder.test.ts tests/server/input-layer/conflict-detector.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/input-layer/review-gate.ts lib/server/input-layer/evidence-binder.ts lib/server/input-layer/conflict-detector.ts tests/server/input-layer
git commit -m "feat: add input review gate"
```

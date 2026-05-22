# 任务包 C：语音/文本归一化与 Readiness 包

> **执行要求：** 本包只把已进入系统的语音/文本输入变成可审查的候选事实和 readiness 结果。不要跳过用户确认，不要生成 committed deck。

**目标：** 将 voice、manual-dictation、text 的轻输入路径稳定下来：轻归一化、语素充足判断、缺失字段 chips、进入 Plan Mode 前的确认请求。

**优先级：** P0

**依赖：** 任务包 A，建议与 B 并行后合并。

## 涉及文件

```text
lib/server/input-layer/text-normalization.ts
lib/server/input-layer/text-extraction-worker.ts
lib/server/input-layer/readiness-service.ts
tests/server/input-layer/text-normalization.test.ts
tests/server/input-layer/text-extraction-worker.test.ts
tests/server/input-layer/readiness-service.test.ts
```

如果 voice backend 已经有 `lib/server/voice/normalization-service.ts` 和 `readiness-service.ts`，本包不要复制逻辑；应抽出共享纯函数或创建 input-layer wrapper。

## 允许的归一化

- 去掉明显口癖：`呃`、`那个`、重复开头。
- 加基础标点。
- 修正高置信 ASR 空格或明显同音错字。
- 保留 raw text 和 normalized text。

## 禁止的归一化

- 擅自补 deadline。
- 把一句话扩成复杂目标。
- 生成卡片。
- 直接生成 A/B/C。
- 删除用户真实意图。

## Readiness 判定

必须返回：

```ts
type InputReadiness = {
  gate: "ready-for-fact-confirmation" | "needs-light-clarification" | "needs-strict-review" | "retry-input";
  confidence: number;
  reasons: string[];
  missingFields: Array<"event" | "time" | "deadline" | "location" | "taskType" | "lifecycle">;
  suggestedChips: Array<{
    field: string;
    label: string;
    value: string;
  }>;
};
```

## 小输入路径

```text
RawInput
-> normalized text
-> candidate facts
-> readiness
-> FactConfirmationRequest(mode: light-card)
```

小输入只要缺字段不高风险，就用 chips/轻确认解决，不要求用户反复说话。

## 验收用例

- `去高数课`：识别事件为到课/课程任务，缺时间或地点时给轻 chips，不直接编造课程时间。
- `明天那个作业提醒我一下`：识别为 ambiguous，缺 event/task reference，不能进入直接 Plan Mode。
- `今晚八点前交英语作文`：识别 deadline，进入 light-card 确认。
- `呃那个就是明天早八去高数`：去口癖，但保留 `明天早八去高数` 意图。
- `manual-dictation` 来源走同样 readiness，但不计 ASR quota。

## 验证命令

```powershell
pnpm test tests/server/input-layer/text-normalization.test.ts tests/server/input-layer/text-extraction-worker.test.ts tests/server/input-layer/readiness-service.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/input-layer/text-normalization.ts lib/server/input-layer/text-extraction-worker.ts lib/server/input-layer/readiness-service.ts tests/server/input-layer
git commit -m "feat: add text input readiness checks"
```

# B：MimoMultimodalExtractor 包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 实现真实 MiMo 多模态 extractor，使图片输入进入标准 `InputExtractionResult`。

**Architecture:** `MimoMultimodalExtractor` 通过 `MimoOpenAIClient` 调用 `mimo-v2.5`，输出先经 validator，再映射为 input-layer 候选和 strict review。Extractor 不写 deck/proof/reminder/profile。

**Tech Stack:** TypeScript, Vitest, MiMo OpenAI-compatible chat completions, Next Card input-layer contracts.

---

## 目标

实现正式 `MimoMultimodalExtractor`，让真实图片识别进入 `lib/server/input-layer` 的标准输出形态：`InputExtractionResult`。这一步只输出候选和 review，不写 deck/proof/reminder/profile。

## 文件

- Create: `lib/server/input-layer/mimo-multimodal-extractor.ts`
- Create: `lib/server/input-layer/mimo-extraction-validator.ts`
- Test: `tests/server/input-layer/mimo-multimodal-extractor.test.ts`
- Test: `tests/server/input-layer/mimo-extraction-validator.test.ts`
- Modify: `lib/server/backend-ports.ts`

## 接口

```ts
export class MimoMultimodalExtractor implements MultimodalExtractionPort {
  constructor(input: {
    client: MimoChatCompletionClient;
    imageOutputDir: string;
    preprocessOptions: ImagePreprocessOptions;
  });

  extract(rawInput: RawInput): Promise<InputExtractionResult>;
}
```

## 输出要求

- 图片课表：
  - `warnings` 包含 `high_risk_multimodal`。
  - 课程时间包含 `course_time`。
  - `reviewRequirement` 为 `strict`。
  - 每条 hard time 候选必须有 evidence。
- prompt-like 文本：
  - `warnings` 包含 `prompt_injection_like_text`。
  - 不执行图片中的指令。
- 失败：
  - 返回可恢复的 blocked/strict review 状态。
  - 不伪造候选。

## 步骤

- [ ] 写 validator 测试：有效 MiMo JSON -> extraction candidates。
- [ ] 写 validator 测试：缺 `needsStrictReview` -> 抛出 schema error。
- [ ] 写 extractor 测试：mock client 返回课程表 JSON -> strict review extraction。
- [ ] 写 extractor 测试：mock client timeout -> recoverable extraction error。
- [ ] 实现 `mimo-extraction-validator.ts`。
- [ ] 实现 `mimo-multimodal-extractor.ts`。
- [ ] 在 `backend-ports.ts` 暴露 provider slot，但默认仍允许 mock fallback。

## 验收

```powershell
pnpm test tests/server/input-layer/mimo-extraction-validator.test.ts tests/server/input-layer/mimo-multimodal-extractor.test.ts
pnpm test tests/server/input-layer tests/server/stress/agent1-agent2-stress-corpus.test.ts
pnpm typecheck
pnpm lint
```

## 不做

- 不做 Deck Commit。
- 不做 Plan Mode。
- 不做正式 proof。

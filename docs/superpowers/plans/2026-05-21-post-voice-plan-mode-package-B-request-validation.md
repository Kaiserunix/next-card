# 任务包 B：Plan Mode 请求校验与错误合同包

> **执行要求：** 本包只实现请求校验和错误对象。不要调用 provider，不要写 repository，不要实现 route handler。

**目标：** 阻止 raw/unconfirmed transcript、缺 handoff、缺 timezone、voice 缺 confirmed transcript id、regenerate 缺 previous draft id 等请求进入 PlanModeService。

**优先级：** P0

**依赖：** A

## 涉及文件

```text
lib/server/plan-mode/request-validation.ts
lib/server/plan-mode/errors.ts
tests/server/plan-mode/request-validation.test.ts
```

## 必须实现的接口

```ts
validatePlanModeRequest(input: unknown): PlanModeRequest
createPlanModeErrorResponse(error: PlanModeError): PlanModeErrorResponse
```

错误码固定为：

```text
PLAN_MODE_NOT_READY
INVALID_PLAN_MODE_REQUEST
PROVIDER_FAILED
PLAN_OUTPUT_INVALID
```

## 校验规则

- `requestId` required。
- `operation` 必须为 `generate` 或 `regenerate`。
- `operation="regenerate"` 必须有 `previousPlanModeDraftId`。
- `source` 必须为允许值。
- `source="voice-confirmed"` 必须有 `confirmedTranscriptId`。
- `planCompilerHandoff` required。
- `planCompilerHandoff.mustGenerateABC === true`。
- `planCompilerHandoff.verifiedInputBundleId` required。
- `planCompilerHandoff.userFacingSummary` required。
- `clientContext.now` required。
- `clientContext.timezone` required。
- `clientContext.locale` 必须为 `zh-CN | en | mixed | auto`。

## 拒绝事项

请求中如果只有这些内容，必须拒绝：

```text
rawTranscript
normalizedText
transcript text
unconfirmed transcript
raw input id without handoff
```

这些字段可作为 trace metadata 出现，但不能替代 `PlanCompilerHandoff`。

## 验收标准

- valid voice-confirmed request 通过。
- voice-confirmed 缺 `confirmedTranscriptId` 被拒绝。
- regenerate 缺 `previousPlanModeDraftId` 被拒绝。
- 缺 handoff 被拒绝。
- `mustGenerateABC=false` 被拒绝。
- 缺 timezone 被拒绝。
- 只有 transcript 文本的请求被拒绝。
- 错误响应含 `recoverable`。

## 验证命令

```powershell
pnpm test tests/server/plan-mode/request-validation.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/plan-mode/request-validation.ts lib/server/plan-mode/errors.ts tests/server/plan-mode/request-validation.test.ts
git commit -m "feat: validate plan mode requests"
```

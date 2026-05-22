# 任务包 A：Post-Voice Plan Mode 合同与 Fixture 包

> **执行要求：** 本包只定义共享类型、provider port、fixture 和合同测试。不要实现 route、真实 provider、repository、deck commit、proof 或 reminder。

**目标：** 建立 `PlanModeRequest`、`PlanModeDraft`、`PlanOptionDraft`、`ActionCardDraft`、`PlanModeProviderPort` 等稳定合同，后续任务包全部复用。

**优先级：** P0

**依赖：** 无。应最先执行。

## 涉及文件

```text
docs/superpowers/specs/2026-05-21-post-voice-plan-mode-backend-contract.md
lib/server/plan-mode/types.ts
tests/server/plan-mode/plan-mode-fixtures.test.ts
tests/fixtures/plan-mode/*.json
```

如果当前 repo 还没有 `lib/server/plan-mode/` 或 `tests/server/plan-mode/`，本包负责创建目录。

## 必须定义的类型

```text
PlanModeSource
PlanModeOperation
PlanModeRegenerateHint
PlanModeRequest
PlanModeResponse
PlanModeErrorResponse
PlanModeDraft
PlanStageDraft
PlanOptionDraft
ActionCardDraft
PlanModeProviderPort
PlanModeProviderInput
PlanModeProviderOutput
PlanModeProviderName
PlanModeWrites
DeckCommitRequestStub
```

核心枚举必须符合：

```ts
type PlanModeSource =
  | "voice-confirmed"
  | "manual-dictation"
  | "text-confirmed"
  | "multimodal-confirmed";

type PlanModeProviderName =
  | "deterministic-local"
  | "mimo"
  | "openai-compatible"
  | "unknown";
```

## 必须保留的 writes 哨兵

`PlanModeDraft` 必须包含：

```ts
writes: {
  deckCommitted: false;
  proofWritten: false;
  remindersCreated: false;
  scheduleQueued: false;
}
```

这不是业务功能，是边界哨兵。后续测试要证明 plan-mode 没有越权。

## 必须准备的 fixtures

```text
voice-confirmed-calculus-handoff.json
manual-dictation-assignment-handoff.json
text-confirmed-study-handoff.json
multimodal-confirmed-timetable-handoff.json
invalid-missing-handoff.json
invalid-voice-without-transcript-id.json
provider-output-valid-abc.json
provider-output-missing-c.json
provider-output-broad-card.json
regenerate-from-previous-draft.json
```

## 合同测试重点

- `PlanModeRequest.planCompilerHandoff.mustGenerateABC` 必须为 `true`。
- valid fixture 能表达 voice/manual/text/multimodal 四类 source。
- invalid voice fixture 缺 `confirmedTranscriptId`。
- provider valid fixture 必须 exactly A/B/C。
- provider invalid fixture 能表达缺 C、宽泛卡片、写入越权。
- `DeckCommitRequestStub` 只作为 future boundary，不能被 plan-mode service 使用。

## 验收标准

- 类型层面能表达 `PlanCompilerHandoff -> PlanModeDraft`。
- 类型层面不能表达 committed deck / proof append / reminder job / queue action 作为 plan-mode 输出。
- fixture 覆盖 generate、regenerate、valid provider、invalid provider、voice traceability。
- 测试能扫描 fixture 并验证字段完整性。

## 验证命令

```powershell
pnpm test tests/server/plan-mode/plan-mode-fixtures.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add docs/superpowers/specs/2026-05-21-post-voice-plan-mode-backend-contract.md lib/server/plan-mode/types.ts tests/server/plan-mode tests/fixtures/plan-mode
git commit -m "feat: define plan mode draft contracts"
```

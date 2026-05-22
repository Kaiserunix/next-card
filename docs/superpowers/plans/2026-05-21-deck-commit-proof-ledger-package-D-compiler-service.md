# 任务包 D：Deck Commit Compiler Service 包

> **执行要求：** 本包只把已验证的 `PlanModeDraft + selectedPlanId` 编译成 `CommittedDeck`、`CommittedCard[]`、`ProofEventRequest` 和 `TimeGuardianDeckHandoff`。不要保存 repository，不要 append proof，不要创建 reminder，不要排程。

**目标：** 将用户选择的一个 A/B/C 方案确定性转换成后端权威 deck/card 初始状态和后续服务 handoff。

**优先级：** P0

**依赖：** A、B。

## 涉及文件

```text
lib/server/deck-commit/deck-compiler.ts
lib/server/deck-commit/goal-contract-builder.ts
lib/server/deck-commit/time-guardian-handoff-builder.ts
lib/server/deck-commit/proof-request-builder.ts
tests/server/deck-commit/deck-compiler.test.ts
tests/server/deck-commit/goal-contract-builder.test.ts
tests/server/deck-commit/time-guardian-handoff-builder.test.ts
tests/server/deck-commit/proof-request-builder.test.ts
```

## 必须实现的接口

```ts
compileCommittedDeck(input: {
  draft: PlanModeDraftLike;
  request: CommitDeckRequest;
  now: string;
}): CompiledDeckCommit

buildGoalContract(draft: PlanModeDraftLike, selectedOption: PlanOptionDraftLike, deckId: string): GoalContract

buildTimeGuardianDeckHandoff(deck: CommittedDeck, cards: CommittedCard[]): TimeGuardianDeckHandoff

buildDeckCommittedProofRequest(input: {
  request: CommitDeckRequest;
  deck: CommittedDeck;
  sourceActionId: string;
}): ProofEventRequest
```

## 编译规则

- 只读取 `selectedPlanId` 对应 option。
- A/C 未选择时不能出现在 output 的 cards、proof requests、Time Guardian handoff 中。
- deck title 默认来自 selected option title，用户 `deckTitle` 可覆盖。
- card title 默认来自 selected option card draft title，用户 override 可覆盖。
- disabled card 只能移除非 required / 非 goal-integrity card。
- `CommittedCard.chosenPlanId` 必须等于 request selectedPlanId。
- `ProofEventRequest.eventType` 固定为 `deck_committed`。
- `ProofEventRequest.sourceService` 固定为 `deck-commit`。
- `ProofEventRequest.summary` 使用中性文案。
- `TimeGuardianDeckHandoff` 只包含 committed refs，不包含 queue action。

## 中性 proof 文案

允许：

```text
已从方案 B 生成卡组：物理预习报告。
```

禁止：

```text
你终于开始行动了。
你的执行力提升了。
你又拖到现在才建卡组。
```

## 测试重点

- `plan-b` draft 只编译 B cards。
- 编译输出包含 exactly one `deck_committed` proof request。
- proof request 不等于 proof event。
- Time Guardian handoff 中所有 cards 的 `chosenPlanId` 都是 `plan-b`。
- disabled non-required card 不进入 cards。
- disabled required card 被 B 包 validator 拒绝，本包不静默绕过。
- proof 文案不含羞辱或诊断词。

## 验收标准

- 本包没有 repository 写入。
- 本包没有 Proof Ledger append。
- 本包没有 reminder creation。
- 本包没有 schedule queue action。
- 输出可被 C、E、G 包直接消费。

## 验证命令

```powershell
pnpm test tests/server/deck-commit/deck-compiler.test.ts tests/server/deck-commit/goal-contract-builder.test.ts tests/server/deck-commit/time-guardian-handoff-builder.test.ts tests/server/deck-commit/proof-request-builder.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/deck-commit/deck-compiler.ts lib/server/deck-commit/goal-contract-builder.ts lib/server/deck-commit/time-guardian-handoff-builder.ts lib/server/deck-commit/proof-request-builder.ts tests/server/deck-commit/*builder.test.ts tests/server/deck-commit/deck-compiler.test.ts
git commit -m "feat: compile selected plan into committed deck"
```

# 任务包 B：Deck Commit 校验与幂等包

> **执行要求：** 本包只实现 Deck Commit 请求校验、用户编辑校验和幂等判断。不要写 repository，不要生成 cards，不要 append proof，不要调用 Time Guardian。

**目标：** 保证只有已 ready 的 `PlanModeDraft` 和用户选择的一个 option 能进入 commit，且同一 draft 不会被重复或换方案提交。

**优先级：** P0

**依赖：** A。

## 涉及文件

```text
lib/server/deck-commit/types.ts
lib/server/deck-commit/errors.ts
lib/server/deck-commit/commit-validator.ts
lib/server/deck-commit/idempotency.ts
tests/server/deck-commit/commit-validator.test.ts
tests/server/deck-commit/idempotency.test.ts
tests/fixtures/deck-commit/*.json
```

## 必须实现的接口

```ts
validateCommitDeckRequest(input: unknown): CommitDeckRequest
validateDraftReadyForCommit(draft: PlanModeDraftLike, request: CommitDeckRequest): CommitValidationResult
validateUserEdits(draft: PlanModeDraftLike, request: CommitDeckRequest): CommitValidationResult
buildDeckCommitIdempotencyKey(request: CommitDeckRequest): string
detectDeckCommitConflict(existing: DeckCommitAudit[], request: CommitDeckRequest): CommitIdempotencyDecision
```

`PlanModeDraftLike` 只需要覆盖本包校验所需字段：

```text
id
status
verifiedInputBundleId
planCompilerHandoffId
options
```

不要在本包直接依赖真实 provider。

## 校验规则

- `requestId` 不能为空。
- `idempotencyKey` 不能为空。
- `planModeDraftId` 不能为空。
- `selectedPlanId` 必须存在于 draft options。
- `draft.status` 必须是 `options-ready`。
- draft options 必须 exactly 3 个，并且 id 分别为 `plan-a`、`plan-b`、`plan-c`。
- 只允许 commit 选中的一个 option。
- `disabledCardDraftIds` 不能移除 required card。
- `cardTitleOverrides` 不能把标题改成空字符串。
- `userEdits` 不能新增 deadline、TimeLock、reminder 或 proof 字段。
- 相同 `idempotencyKey` 的重复请求返回 existing result。
- 相同 draft 使用不同 `selectedPlanId` 再 commit 必须拒绝。

## 错误合同

```ts
type CommitDeckErrorCode =
  | "INVALID_COMMIT_REQUEST"
  | "PLAN_DRAFT_NOT_FOUND"
  | "PLAN_DRAFT_NOT_READY"
  | "SELECTED_PLAN_NOT_FOUND"
  | "DRAFT_ALREADY_COMMITTED"
  | "INVALID_USER_EDIT"
  | "GOAL_INTEGRITY_VIOLATION"
  | "DECK_COMMIT_IDEMPOTENCY_CONFLICT";
```

错误对象必须包含：

```text
code
message
recoverable
```

## 测试重点

- `plan-b` 可以通过校验。
- `plan-b` 提交时 A/C 不进入 validation output。
- `draft.status="blocked"` 被拒绝。
- 缺 `idempotencyKey` 被拒绝。
- `regenerate` 后旧 draft 与新 draft 不混淆。
- 重复同一个 `idempotencyKey` 返回 replay decision。
- 同一 draft 改选 `plan-c` 被拒绝。
- 用户编辑移除 required card 被拒绝。
- 用户编辑试图注入 `proofWritten` 或 `timeLock` 字段被拒绝。

## 验收标准

- validator 不写任何文件。
- validator 不 import Proof Ledger writer。
- validator 不 import Time Guardian writer。
- 幂等判断能区分 replay、new commit、conflict。
- 错误码稳定，API route 可直接复用。

## 验证命令

```powershell
pnpm test tests/server/deck-commit/commit-validator.test.ts tests/server/deck-commit/idempotency.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/deck-commit/errors.ts lib/server/deck-commit/commit-validator.ts lib/server/deck-commit/idempotency.ts tests/server/deck-commit/commit-validator.test.ts tests/server/deck-commit/idempotency.test.ts
git commit -m "feat: validate deck commit requests"
```

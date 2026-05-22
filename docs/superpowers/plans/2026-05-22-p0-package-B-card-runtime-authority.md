# B：Card Runtime 权威动作包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 实现 committed card 的最小后端运行时动作：start、complete、freeze、burn、defer、resume，并通过 Proof Ledger 写入事实事件。

**Architecture:** Card Runtime 是 `card_completed` 的唯一来源。它读取 committed deck/card，校验动作、更新 card runtime 状态、向 Proof Outbox 提交 proof request。Time Guardian 参与 defer/freeze/recovery 校验，但不能直接伪造完成。

**Tech Stack:** TypeScript, Vitest, Next.js route handlers, local JSON repositories under `.nextcard-data`.

---

## 目标

当前已有 Deck Commit 和 Proof Ledger，但缺少用户执行 card 后的权威动作入口。P0 要让一张已 commit 的 card 可以被启动、完成、冻结、进入 burning、推迟或恢复，并形成 proof timeline 可读取的事件。

## 文件

- Create: `lib/server/card-runtime/types.ts`
- Create: `lib/server/card-runtime/card-runtime-repository.ts`
- Create: `lib/server/card-runtime/card-runtime-validator.ts`
- Create: `lib/server/card-runtime/card-runtime-service.ts`
- Create: `app/api/backend/card/action/route.ts`
- Modify: `lib/server/proof-ledger/types.ts`
- Modify: `lib/server/proof-ledger/proof-event-validator.ts`
- Test: `tests/server/card-runtime/card-runtime-service.test.ts`
- Test: `tests/server/card-runtime/card-runtime-boundary-redteam.test.ts`
- Test: `tests/api/backend/card/action-route.test.ts`

## 动作合同

```ts
type CardRuntimeAction =
  | "start"
  | "complete"
  | "freeze"
  | "burn_start"
  | "burn_complete"
  | "defer"
  | "resume";
```

```text
POST /api/backend/card/action
{
  requestId,
  deckId,
  cardId,
  action,
  actualMinutes?,
  reason?,
  clientContext?: { now, timezone, anonymousDeviceId, userId }
}
-> {
  cardRuntimeState,
  proofEvents,
  timeGuardianActions,
  boundaryWarnings
}
```

## 关键规则

- `complete` 必须来自 Card Runtime route/service，Proof Ledger 直接收到伪造 `card_completed` 仍应拒绝。
- `complete` 只能作用于 committed deck 中存在的 card。
- 不能完成未选择 A/B/C option 里的 card。
- `freeze` 不删除 card，只进入 frozen/reschedule review。
- `burn_start` / `burn_complete` 是压力信号，不是失败。
- `defer` 必须经过 Time Guardian 校验，不能撞 hard lock。
- 同一 `requestId` 必须幂等。

## 步骤

- [ ] 定义 `CardRuntimeState`、`CardRuntimeEvent`、`CardRuntimeActionRequest`。
- [ ] 实现 JSON repository，默认写 `.nextcard-data/card-runtime.json`。
- [ ] 实现 action validator：检查 deck/card 存在、状态迁移合法、requestId 幂等。
- [ ] 实现 `start`：记录 startedAt，不写 completed proof。
- [ ] 实现 `complete`：更新状态，创建 `card_completed` proof request，写入 Proof Ledger。
- [ ] 实现 `freeze`：更新状态，创建 `card_frozen` proof request，返回 Time Guardian recovery/requeue hint。
- [ ] 实现 `burn_start` / `burn_complete`：写 pressure-signal proof，不写 failure。
- [ ] 实现 `defer`：调用 Time Guardian defer/recovery 校验，unsafe 时返回 rejected action，不改 hard lock。
- [ ] 实现 route，错误输出不得包含 token/raw file/data URL。
- [ ] 写红队：ProofLedger 直接写 `card_completed` 仍拒绝；Card Runtime 写入则允许。

## 验收

```powershell
pnpm test tests/server/card-runtime tests/api/backend/card
pnpm test tests/server/proof-ledger
pnpm typecheck
pnpm lint
```

## 不做

- 不做手势前端。
- 不发系统通知。
- 不做完整 reward card UI。
- 不允许 Card Runtime 改 Plan Mode draft 或 hard lock。

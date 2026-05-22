# C：Proof Timeline 读取投影包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 为 proof 提供只读 timeline/projection route，让测试者能看到 deck commit、card complete、freeze、burn、defer 等事件的时间线流动。

**Architecture:** Proof Timeline 是 read model。它读取 Proof Ledger、deck/card/runtime repository，并投影出用户可见状态。它不能 append proof，不能修改 deck/card/reminder/profile。

**Tech Stack:** TypeScript, Vitest, Next.js route handlers, local JSON repositories under `.nextcard-data`.

---

## 目标

当前 Proof Ledger 可以 append，但缺少稳定读取入口。P0 需要一个 route/API 能输出 proof 时间线，支持 sandbox 和正式 local JSON store，供 CLI、后续前端和测试报告消费。

## 文件

- Create: `lib/server/proof-ledger/proof-timeline-projection.ts`
- Create: `app/api/backend/proof/timeline/route.ts`
- Modify: `lib/server/proof-ledger/types.ts`
- Test: `tests/server/proof-ledger/proof-timeline-projection.test.ts`
- Test: `tests/api/backend/proof/timeline-route.test.ts`

## 输出合同

```ts
type ProofTimelineEntry = {
  id: string;
  occurredAt: string;
  type:
    | "deck_committed"
    | "card_started"
    | "card_completed"
    | "card_frozen"
    | "burn_started"
    | "burn_completed"
    | "card_deferred"
    | "deadline_warning"
    | "reminder_delivered";
  deckId?: string;
  cardId?: string;
  title: string;
  statusColor: "gray" | "blue" | "green" | "ice" | "orange" | "red" | "gold";
  userVisibleCopy: string;
  nextSuggestion?: string;
  source: "proof-ledger";
};
```

```text
GET /api/backend/proof/timeline?deckId=...&userId=...&sandboxRunId=...
-> {
  entries,
  summary,
  boundaryWarnings
}
```

## 关键规则

- route 是只读。
- 不提供 `POST /api/backend/proof/write`。
- 投影文案不得出现“懒”“自律差”“失败人格”等羞辱/诊断词。
- failed notification delivery 不算用户忽略。
- freeze/burn 只显示为状态事实和恢复入口，不显示惩罚。

## 步骤

- [ ] 定义 projection types。
- [ ] 实现 ledger event -> timeline entry 映射。
- [ ] 聚合 deck/card runtime 状态，生成 `summary`。
- [ ] 支持按 `deckId`、`userId`、`anonymousDeviceId`、`sandboxRunId` 过滤。
- [ ] route 读取默认 `.nextcard-data` store；sandbox 可通过安全参数定位 sandbox run。
- [ ] 写测试：deck commit + card completed 顺序正确。
- [ ] 写测试：freeze/burn 文案中性。
- [ ] 写测试：route 不接受 proof append payload。
- [ ] 写测试：不存在 deck 时返回空 timeline 或 recoverable error，不抛 500。

## 验收

```powershell
pnpm test tests/server/proof-ledger tests/api/backend/proof
pnpm typecheck
pnpm lint
```

## 不做

- 不做 proof dashboard 前端。
- 不做图表。
- 不做 summary document 导出。
- 不修改 proof ledger append-only 语义。

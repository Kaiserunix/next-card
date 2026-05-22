# E：Backend Orchestrator 沙盒全链路包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 串起真实后端沙盒链路，产出可审计 `BackendRunReport`。

**Architecture:** Orchestrator 只编排已有服务和沙盒 repositories，不绕过 Review Gate、Plan Mode、Deck Commit、Time Guardian 或 Proof Ledger 的边界。正式 stores 不被污染。

**Tech Stack:** TypeScript, Vitest, Next.js route handlers, local JSON sandbox stores.

---

## 目标

把已存在和新增的后端服务串成沙盒全链路，供内测和真实 MiMo 慢跑使用。它证明后端模块已经能形成真实闭环，但不污染正式 deck/proof stores。

## 文件

- Create: `lib/server/backend-orchestrator/types.ts`
- Create: `lib/server/backend-orchestrator/sandbox-run-service.ts`
- Create: `app/api/backend/sandbox/run/route.ts`
- Test: `tests/server/backend-orchestrator/sandbox-run-service.test.ts`
- Test: `tests/api/backend/sandbox/run-route.test.ts`

## 链路

```text
Raw input / uploaded image
-> ImportReviewService
-> optional confirmed facts fixture
-> PlanModeService
-> DeckCommitService in sandbox repository
-> TimeGuardian service facade
-> ProofLedger sandbox append
-> BackendRunReport
```

## 输出

```ts
type BackendRunReport = {
  reportId: string;
  sandbox: true;
  importReview: ImportReviewReport;
  planModeDraft?: PlanModeDraft;
  committedDeck?: CommittedDeck;
  committedCards?: CommittedCard[];
  timeGuardianActions: QueueAction[];
  proofTimeline: ProofEvent[];
  boundaryWarnings: string[];
  errors: Array<{ stage: string; message: string; recoverable: boolean }>;
};
```

## 步骤

- [ ] 写 service 测试：text happy path 生成 report。
- [ ] 写 service 测试：image strict review 不能自动 commit。
- [ ] 写 service 测试：用户选择 B 时只 commit B。
- [ ] 写 service 测试：Time Guardian 不调度未选择 option。
- [ ] 写 route 测试：response 不含 token。
- [ ] 实现 sandbox repositories。
- [ ] 实现 `sandbox-run-service.ts`。
- [ ] 实现 route。

## 验收

```powershell
pnpm test tests/server/backend-orchestrator tests/api/backend/sandbox
pnpm test tests/server/stress/agent1-agent2-stress-corpus.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

## 不做

- 不做正式 UI。
- 不发送系统通知。
- 不接系统日历。

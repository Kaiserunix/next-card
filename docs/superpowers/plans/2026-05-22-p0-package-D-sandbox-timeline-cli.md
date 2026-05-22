# D：Sandbox 时间线压测入口包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 让测试者不用网页平台，也能用 CLI/API 跑完整后端链路，并传入复杂时间锁、可用窗口、已选方案和卡片动作，观察 Time Guardian 与 Proof Timeline。

**Architecture:** Sandbox Orchestrator 只用 sandbox repositories，不污染正式 store。它必须保留 review gate、A/B/C 选择、Deck Commit、Card Runtime、Time Guardian、Proof Ledger 边界。

**Tech Stack:** TypeScript, Vitest, Next.js route handlers, Node CLI.

---

## 目标

当前 `POST /api/backend/sandbox/run` 已能跑 text happy path，但复杂 `timeLocks` / `availableWindows` 的 HTTP 输入解析与 CLI 操作还不够强。P0 需要补一个实用测试入口，专门压测 Agent2 时间线理解能力和整条链路的 proof 流动。

## 文件

- Modify: `lib/server/backend-orchestrator/types.ts`
- Modify: `lib/server/backend-orchestrator/sandbox-run-service.ts`
- Modify: `app/api/backend/sandbox/run/route.ts`
- Create: `scripts/backend-chain-smoke.mjs`
- Modify: `package.json`
- Test: `tests/server/backend-orchestrator/sandbox-run-time-inputs.test.ts`
- Test: `tests/api/backend/sandbox/run-route-time-inputs.test.ts`
- Test: `tests/scripts/backend-chain-smoke.test.ts`

## CLI 草案

```powershell
pnpm backend:chain -- --case text-assignment --selected-option plan-b
pnpm backend:chain -- --case strict-image-confirmed --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --selected-option plan-b
pnpm backend:chain -- --case crowded-timeline --selected-option plan-c
pnpm backend:chain -- --case notification-relative --selected-option plan-b
```

输出应包含：

- import review status
- whether fact confirmation was required
- selected option
- committed deck/cards
- queue actions summary
- card runtime actions summary
- proof timeline entries
- report path under `.nextcard-data/backend-chain-runs/<timestamp>/`

## API 增强

`POST /api/backend/sandbox/run` 应完整解析：

- `timeLocks`
- `availableWindows`
- `selectedOptionId`
- `cardActions`
- `confirmedFacts` 或 `confirmationAction`
- `notificationCapability`

## 步骤

- [ ] 扩展 `BackendSandboxRunCommand` 类型，加入 `cardActions`、`notificationCapability`、`confirmation`。
- [ ] 修复/增强 route JSON validator：完整保留 `timeLocks` / `availableWindows`，非法时间返回 400 recoverable error。
- [ ] Orchestrator 在 commit 后可执行一组 Card Runtime actions，并把 proof timeline 放入 report。
- [ ] 实现 CLI，默认用 service 直跑，不要求 dev server。
- [ ] CLI 支持 `--route-url` 可选走真实 route。
- [ ] 内置 4 个 case：text assignment、strict image confirmed、crowded timeline、notification relative date。
- [ ] 写测试：crowded timeline 不移动 hard lock。
- [ ] 写测试：selected plan B 时不 schedule A/C。
- [ ] 写测试：card complete 后 timeline 出现 `card_completed`。
- [ ] 写测试：strict image 未确认时停在 review；确认后继续。

## 验收

```powershell
pnpm test tests/server/backend-orchestrator tests/api/backend/sandbox tests/scripts/backend-chain-smoke.test.ts
pnpm backend:chain -- --case text-assignment --selected-option plan-b
pnpm backend:chain -- --case crowded-timeline --selected-option plan-b
pnpm typecheck
pnpm lint
```

## 不做

- 不做网页测试平台。
- 不发真实系统通知。
- 不写生产数据库。
- 不把 sandbox run 当正式用户数据。

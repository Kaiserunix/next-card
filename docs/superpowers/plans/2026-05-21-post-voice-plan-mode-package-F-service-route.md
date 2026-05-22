# 任务包 F：PlanMode Service 与 API Route 包

> **执行要求：** 本包把 A-E 串成可调用后端 route。Route handler 必须薄，业务逻辑在 `lib/server/plan-mode/*`。

**目标：** 实现 `POST /api/backend/plan-mode`，接受 `PlanCompilerHandoff`，返回经过校验并保存的 `PlanModeDraft`。

**优先级：** P0

**依赖：** A、B、C、D、E

## 涉及文件

```text
lib/server/plan-mode/plan-mode-service.ts
app/api/backend/plan-mode/route.ts
tests/server/plan-mode/plan-mode-service.test.ts
tests/api/backend/plan-mode-route.test.ts
```

## 必须实现的接口

```ts
class PlanModeService {
  createDraft(input: unknown): Promise<PlanModeResponse>;
}
```

Route:

```text
POST /api/backend/plan-mode
```

## Service 流程

```text
validate request
-> call configured provider
-> validate provider output
-> if provider fails/invalid, call deterministic-local provider
-> validate fallback output
-> save draft to repository
-> return { draft }
```

## Provider 选择规则

第一实现可以只配置 deterministic-local。

如果后续有真实 provider：

- 真实 provider failure 不应让 demo 直接死。
- provider invalid output 必须 fallback。
- response provider 字段必须显示最终被接受的 provider。

## Route 行为

- valid request -> `200`。
- invalid request -> `400`。
- not ready -> `409` 或 `400`，但错误码必须为 `PLAN_MODE_NOT_READY`。
- provider failed but fallback succeeded -> `200`，draft.provider 为 `deterministic-local`。
- provider failed and fallback failed -> `502`。

## 禁止行为

Route/service 不能 import：

```text
time-guardian queue writer
proof ledger writer
deck commit service
reminder service
frontend store
provider SDK inside UI
```

## 验收标准

- route 可接受 valid fixture。
- route 返回 options-ready draft。
- route 拒绝无 handoff 请求。
- route 拒绝 voice 缺 transcript id。
- route regeneration 缺 previous id 被拒绝。
- service 保存 draft。
- service fallback 到 deterministic-local。
- tests 证明无 deck/proof/reminder/schedule writes。

## 验证命令

```powershell
pnpm test tests/server/plan-mode/plan-mode-service.test.ts tests/api/backend/plan-mode-route.test.ts
pnpm typecheck
pnpm lint
```

## 建议提交

```powershell
git add lib/server/plan-mode/plan-mode-service.ts app/api/backend/plan-mode/route.ts tests/server/plan-mode tests/api/backend/plan-mode-route.test.ts
git commit -m "feat: expose plan mode backend route"
```

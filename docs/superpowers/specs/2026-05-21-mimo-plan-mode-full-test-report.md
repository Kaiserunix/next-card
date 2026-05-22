# 2026-05-21 Mimo Plan Mode 接入与全量测试记录

## 测试时间

- 执行时间：2026-05-21 20:33:57 +08:00
- 工作目录：`C:\Users\qwerf\Desktop\nextcard`

## 接入状态

本轮把 Plan Mode 默认 provider 接到 Mimo：

- `PlanModeService()` 在非 test 环境下，如果存在 `MIMO_API_KEY`，默认使用 `MimoPlanModeProvider`。
- test 环境仍默认使用 `deterministic-local`，避免单元测试误打真实网络。
- 可通过 `NEXTCARD_PLAN_MODE_PROVIDER=mimo` 显式启用 Mimo。
- Mimo 失败或输出非法时仍保留 deterministic fallback。

相关文件：

- `lib/server/plan-mode/plan-mode-service.ts`
- `lib/server/plan-mode/mimo-plan-provider.ts`
- `lib/server/mimo-openai-client.ts`
- `tests/server/plan-mode/plan-mode-service.test.ts`
- `.env.example`

## 真实 Mimo Smoke

启动命令：

```bash
pnpm exec next dev -H 127.0.0.1 -p 3025
```

请求：

```bash
POST http://127.0.0.1:3025/api/backend/plan-mode
body: tests/fixtures/plan-mode/voice-confirmed-calculus-handoff.json
```

结果：

```text
provider: mimo
modelRunId: mimo_4da6f395-3f34-4052-9376-2dc6bb290293
optionCount: 3
modes: A,B,C
deckCommitted: false
proofWritten: false
remindersCreated: false
scheduleQueued: false
draftId: draft_mimo_0360ac5f-e8b7-441f-a69b-f4b73481e9a6
```

结论：真实 Mimo 路径已通过 API route 返回 `provider=mimo` 的 Plan Mode draft，且未写 deck/proof/reminder/schedule 权威状态。

## Focused Tests

命令：

```bash
pnpm test tests/server/plan-mode/plan-mode-service.test.ts tests/server/mimo-openai-client.test.ts tests/api/backend/plan-mode-route.test.ts
```

结果：

```text
Test Files 3 passed
Tests 9 passed
```

## 全量验证

### Vitest

命令：

```bash
pnpm test
```

结果：

```text
Test Files 70 passed
Tests 363 passed
```

### Lint

命令：

```bash
pnpm lint
```

结果：通过。

### Build

命令：

```bash
pnpm build
```

结果：通过。

构建路由：

```text
/                                      static
/_not-found                            static
/api/backend/plan-mode                 dynamic
/api/backend/voice/confirm             dynamic
/api/backend/voice/normalize           dynamic
/api/backend/voice/readiness           dynamic
/api/backend/voice/transcribe          dynamic
```

### Typecheck

命令：

```bash
pnpm typecheck
```

结果：通过。

## 结论

Mimo 已接入 Plan Mode API route 的默认运行路径。当前全量 `pnpm test`、`pnpm lint`、`pnpm build`、`pnpm typecheck` 均通过。Mimo 真实 smoke 已确认返回 A/B/C 方案，并保持 Plan Mode 不提交 deck/proof/reminder/schedule 的边界。

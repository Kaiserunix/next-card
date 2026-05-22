# Backend Long-Run Test Report

Date: 2026-05-17

Scope: broad backend verification across API routes, queue scheduling, freeze
return, Mimo provider normalization, agent runtime, persistence, push, calendar,
and worker dispatch.

## Parallel Lanes

| Lane | Area | Result |
|---|---|---|
| Worker A | API route contracts | Added route contract tests; fixed blank `inputText` and blank `rawText` validation |
| Worker B | Schedule/freeze/worker stress | Added stress tests; no scheduler/freeze implementation bug found |
| Worker C | Mimo provider + agent runtime robustness | Added robustness tests; fixed inflated `messagesUsed` normalization |
| Worker D | Queue repository + provider persistence | Added persistence/provider tests; fixed bad JSON fallback and Web Push all-failed status |

## Real Issues Fixed

1. `POST /api/backend/plan-mode` accepted blank `inputText`.
2. `POST /api/backend/import/review` accepted blank `rawText`.
3. Mimo planner normalization trusted provider-returned `context.messagesUsed`
   even when it exceeded actual supplied context.
4. `JsonFileQueueRepository.readSnapshot()` threw on bad JSON instead of
   falling back to an empty worker snapshot.
5. Web Push returned `updated` for `update-reminder` even when every delivery
   failed.

## Coverage Added

New or expanded backend tests cover:

- backend health and provider configuration without leaking secrets
- Plan Mode route shape and request validation
- multimodal import review route shape and coverage checks
- hard time locks and queue movement boundaries
- freeze return decisions and mixed freeze sweep states
- repeated worker ticks and `processedActionIds` idempotency
- Mimo HTTP errors, invalid JSON, sparse output, `reasoning_content`, and
  multimodal import normalization
- agent runtime skill ordering and automatic triggers
- JSON queue snapshot roundtrip and bad JSON fallback
- push subscription persistence
- Web Push / ICS provider dispatch and failure reporting

## Verification

```bash
pnpm test
# 32 files passed, 280 tests passed
```

Repeated three times:

```text
round 1: 32 files / 280 tests passed
round 2: 32 files / 280 tests passed
round 3: 32 files / 280 tests passed
```

```bash
pnpm lint
# passed

pnpm build
# passed
```

Runtime API smoke on `http://127.0.0.1:3001`:

```text
GET  /api/backend/health             200
POST /api/backend/plan-mode          200 ready-to-build
POST /api/backend/plan-mode blank    400
POST /api/backend/import/review      200, 2 top-level cards
POST /api/backend/import/review blank 400
POST /api/backend/schedule/plan      200, reminder + reveal + deal actions
POST /api/backend/worker/tick        200, reminder + reveal + deal actions
```

## Notes

- Local `health.providers.ai.configured` remains `false` until `.env.local`
  includes `MIMO_API_KEY`.
- Web Push dispatch currently reports `notification:failed` in local smoke
  when VAPID keys/subscriptions are not configured; this is expected and now
  represented honestly.
- Next `.next` cache can corrupt when dev server and build/tests overlap on
  Windows. Stop the dev server and clear `.next` before trusting build trace
  failures.

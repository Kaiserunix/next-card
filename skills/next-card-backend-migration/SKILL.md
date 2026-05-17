---
name: next-card-backend-migration
description: Use when migrating Next Card backend capability, swapping frontends, or connecting real multimodal import/AI/worker/database/reminder/calendar providers without breaking the card product contract.
---

# Next Card Backend Migration

Use this skill when a teammate or another AI needs to migrate backend work into a different Next Card frontend, or replace the frontend while keeping the backend stable.

## Read First

Open these files before editing:

```text
AGENTS.md
docs/backend-extension-boundaries.md
docs/agent-runtime-architecture.md
lib/types.ts
lib/server/backend-ports.ts
lib/server/agent-runtime.ts
tests/server/schedule-planner.test.ts
tests/server/freeze-return-agent.test.ts
tests/server/plan-mode-service.test.ts
tests/server/import-coverage.test.ts
tests/server/backend-worker.test.ts
```

## Stable Backend Ports

Do not import provider SDKs in UI components. Add or replace providers behind:

```text
AiPlannerPort
MultimodalImportParserPort
SchedulePlannerPort
NotificationPort
CalendarPort
QueueRepository
BackendWorkerPort
```

Agent runtime skill registry:

```text
lib/server/agent-runtime.ts
```

The current factory is:

```text
lib/server/backend-services.ts
```

## Current API Surface

```text
GET  /api/backend/health
POST /api/backend/plan-mode
POST /api/backend/import/review
POST /api/backend/schedule/plan
POST /api/backend/freeze/return
POST /api/backend/worker/tick
GET  /api/backend/push/public-key
POST /api/backend/push/subscriptions
POST /api/backend/push/send
POST /api/backend/calendar/events
```

## Migration Rules

- Keep `input / deck / proof` as the only primary frontend modes.
- Large imports must call `/api/backend/import/review` and show one mandatory review gate before creating many cards.
- The worker may insert, move, deal, reveal, remind, calendar-sync, return frozen cards, or split frozen cards.
- Hard `TimeLock` entries are not movable by the agent. Use suggestion/review actions instead of silent overwrite.
- Deck execution should show only the first one or two dealt cards; background items stay hidden or queued.
- Frozen cards must become `FrozenTaskEntry` records and return through the freeze-return agent, not a simple fixed timer.
- Push provider is Web Push/VAPID. Do not expose `NEXT_CARD_PUSH_VAPID_PRIVATE_KEY` to the client.
- Calendar provider currently writes `.ics` files. Do not add Google/Microsoft OAuth unless the user asks for that exact provider.

## Required Checks

Run these before handoff:

```bash
pnpm test tests/server/schedule-planner.test.ts tests/server/freeze-return-agent.test.ts tests/server/plan-mode-service.test.ts tests/server/import-coverage.test.ts tests/server/backend-worker.test.ts
pnpm test tests/server/web-push-provider.test.ts tests/server/ical-calendar-provider.test.ts tests/server/provider-dispatch.test.ts tests/server/push-service.test.ts
pnpm lint
pnpm build
```

Run `pnpm test` when touching shared types, store state, or mock AI fallback behavior.

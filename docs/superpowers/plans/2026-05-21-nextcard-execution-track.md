# Next Card Execution Track

## Purpose

This track is for implementers. It executes written plans and reports verification. It should not reopen product decisions unless the plan is contradictory, impossible, or missing a required file boundary.

## Primary Plan

Start with:

```text
docs/superpowers/plans/2026-05-21-voice-backend-implementation-plan.md
```

## Execution Rules

- Follow `AGENTS.md`, especially the Active 2026-05-21 Alignment section.
- Do not implement frontend redesign in the voice-backend slice.
- Do not implement Plan Mode backend, deck/proof backend writes, streaming ASR, Android bridge, Aliyun/Tencent providers, or database persistence in the first slice.
- Keep backend route handlers thin under `app/api/backend/voice/*`.
- Keep service logic under `lib/server/voice/*`.
- Use `lib/server/backend-ports.ts` for provider boundaries.
- Keep deck/proof state in frontend `localStorage` for this phase.
- Store only voice usage records and confirmed transcript metadata in backend local JSON.

## First Execution Package

Implement these tasks from the primary plan:

1. Runtime skeleton and test foundation.
2. Voice contracts and error model.
3. Normalization and readiness services.
4. Usage and transcript repositories plus quota service.
5. Volcengine ASR provider.
6. Voice API routes.
7. Documentation and handoff.

## Required Verification

Before claiming completion, run:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

If the root app has not yet been restored or frontend import changes the package layout, first reconcile the runtime skeleton with the imported frontend, then rerun all checks.

## Executor Final Report Format

```text
Change summary:
- ...

Verification:
- pnpm test: ...
- pnpm typecheck: ...
- pnpm lint: ...
- pnpm build: ...

Remaining mocked or deferred capabilities:
- Plan Mode backend
- streaming ASR
- Android native speech bridge
- Aliyun/Tencent providers
- deck/proof backend persistence
```

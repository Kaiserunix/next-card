# 2026-05-21 Git Worktree Triage

## Snapshot

- Branch: `codex/voice-backend-slice`
- Remote: `origin https://github.com/Kaiserunix/next-card.git`
- Last known HEAD: `2b7b5da test: add spoken voice corpus coverage`
- Current tracked changes: `53` files changed in tracked diff
- Current tracked diff size: `298 insertions`, `7086 deletions`
- Current status classes:
  - `47` tracked deletions
  - `6` tracked modifications
  - `44` untracked path groups/files

## Important Warning

Do not run:

```bash
git add .
git add -A
```

The worktree mixes PM/spec documents, backend architecture implementation, dependency changes, and a large old-frontend removal. A single bulk add would create an unreadable commit and may hide whether old source deletion was intentional or accidental.

## Current Buckets

### Bucket A: PM / Architecture Documents

Likely safe to review and commit as a documentation alignment batch:

```text
AGENTS.md
docs/superpowers/specs/voice-opening-ui-design.md
docs/superpowers/specs/2026-05-21-hidden-agent-profile-architecture.md
docs/superpowers/specs/2026-05-21-soft-task-and-deck-library.md
docs/superpowers/specs/2026-05-21-voice-plan-mode-backend-design.md
docs/superpowers/specs/2026-05-21-nextcard-pm-question-log.md
docs/superpowers/specs/2026-05-21-action-review-profile-adaptation-plan.md
docs/superpowers/specs/2026-05-21-overall-hidden-runtime-architecture.md
docs/superpowers/specs/2026-05-21-next-card-hidden-runtime-architecture.svg
docs/superpowers/specs/2026-05-21-freeze-rollback-and-test-image-standard.md
docs/superpowers/plans/2026-05-21-voice-backend-implementation-plan.md
docs/superpowers/plans/2026-05-21-nextcard-pm-qa-track.md
docs/superpowers/plans/2026-05-21-nextcard-execution-track.md
docs/superpowers/plans/2026-05-21-input-layer-*.md
docs/superpowers/plans/2026-05-21-time-guardian-*.md
```

Recommended commit title:

```text
docs: align hidden runtime architecture plans
```

### Bucket B: Backend Implementation In Progress

Review and verify before staging. This appears to be the agent architecture implementation lane:

```text
lib/server/input-layer/
lib/server/time-guardian/
tests/server/input-layer/
tests/server/time-guardian/
tests/fixtures/input-layer/
tests/fixtures/time-guardian/
docs/superpowers/specs/2026-05-21-input-layer-contract.md
docs/superpowers/specs/2026-05-21-input-layer-redteam-cases.md
docs/superpowers/specs/2026-05-21-input-layer-skill-draft.md
docs/superpowers/specs/2026-05-21-time-guardian-contract.md
docs/superpowers/specs/2026-05-21-time-guardian-redteam-cases.md
docs/superpowers/specs/2026-05-21-time-guardian-skill-draft.md
lib/server/backend-ports.ts
package.json
pnpm-lock.yaml
```

Required before commit:

```bash
pnpm lint
pnpm build
pnpm test
```

If tests are too broad because the frontend was intentionally removed, run and document the narrower backend tests first, then fix the default scripts later.

Recommended commit title after verification:

```text
feat: add governed input and time guardian runtime services
```

### Bucket C: High-Risk Old Frontend / Test Deletions

These are tracked deletions and should not be staged until the project owner confirms this exact source removal is intended:

```text
.github/CODEOWNERS
.github/workflows/ci.yml
components/**
lib/card-time-engine.ts
lib/mock-ai.ts
lib/page-contracts.ts
lib/types.ts
lib/webview-contract.ts
playwright.config.ts
postcss.config.mjs
scripts/run-tests.mjs
store/useNextCardStore.ts
tailwind.config.ts
tests/e2e/**
tests/fixtures/ai-expanded-cases.ts
tests/fixtures/timetables/**
tests/helpers/**
tests/lib/**
tests/scripts/**
tests/setup/**
tests/store/**
tests/unit/**
```

Context:

```text
废弃文件夹/旧实现-20260520-225958
```

The deprecated folder is ignored by `.gitignore`, so a commit will only preserve the deletion from tracked source paths. It will not preserve the backup folder in git.

Recommended handling:

1. Confirm whether old frontend/source deletion is part of the final cleanup.
2. Confirm new imported frontend and backend tests still satisfy the AGENTS.md contract.
3. Commit deletions separately from docs and backend implementation.

Recommended commit title if confirmed:

```text
chore: remove deprecated frontend implementation
```

### Bucket D: Generated Reports / Side Documents

These need owner review before inclusion because they may be temporary evidence rather than product docs:

```text
docs/agent-runtime-architecture.md
docs/backend-long-run-test-report.md
docs/backend-real-usage-simulation-report.md
docs/AI-BEHAVIOR.md
docs/backend-extension-boundaries.md
```

Notes:

- `docs/AI-BEHAVIOR.md` currently references runtime concepts such as behavior vectors and local agent profiles.
- `docs/backend-extension-boundaries.md` currently describes implemented backend routes and provider files. Verify those files exist before treating the doc as authoritative.

## Suggested Commit Order

1. Documentation alignment only: Bucket A plus this triage note.
2. Backend implementation: Bucket B after test/build verification.
3. Runtime/behavior docs: Bucket D after checking they match real files.
4. Deprecated frontend removal: Bucket C only after explicit confirmation and replacement verification.

## Current Clean-Up Rule

Until the implementation agent reports back, use this worktree as a mixed integration area. Prefer exact-path staging over bulk staging.

Example safe staging for the first docs batch:

```bash
git add AGENTS.md docs/superpowers/plans/2026-05-21-*.md docs/superpowers/specs/2026-05-21-*.md docs/superpowers/specs/voice-opening-ui-design.md
git status --short
```

Do not include `lib/`, `tests/`, `package.json`, `pnpm-lock.yaml`, or tracked deletions in the first docs batch unless that is the explicit target of the commit.

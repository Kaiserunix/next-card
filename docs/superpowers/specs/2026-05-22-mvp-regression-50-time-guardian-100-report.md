# 2026-05-22 MVP Regression 50 Time Guardian 100-Case Report

## Scope

This run used the local oracle corpus:

```text
docs/superpowers/test-images/2026-05-21-mvp-regression-50
```

The corpus contains 50 image cases. Their JSON files are oracle metadata, not full OCR output. The test therefore maps `expectedCandidates`, `expectedWarnings`, and `mustNotDo` into confirmed synthetic schedule overlays, then exercises Time Guardian scheduling, queue validation, and insertion.

The test seed is fixed:

```text
20260521
```

## New Coverage

Added:

```text
tests/server/timeline-complexity/mvp-regression-50-time-guardian.test.ts
```

Coverage:

- Loads all 50 local image oracle records and verifies image files exist.
- Builds exactly 100 deterministic combinations from the 50 records.
- Mixes `timetable`, `assignment`, `notification`, `relative-date`, `conflict`, `low-quality`, `prompt-injection-like-document-content`, `chat`, and `blocked` categories.
- Tests `scheduleCommittedDeck -> validateQueueAction -> insertScheduledEvent` with an evolving snapshot.
- Confirms blocked inputs produce no cards or schedule writes.
- Confirms conflict cases request user review instead of moving hard locks or forcing cards into protected time.
- Confirms normal cases insert internal card-window events without overlapping time locks, existing scheduled events, active scheduled cards, or deadlines.
- Confirms unselected plan cards are not scheduled.
- Confirms prompt-injection-like source text does not leak into executable schedule action semantics.
- Confirms TimeLocks remain unchanged after scheduling and insertion.

## Bugs Found And Fixed

### 1. Insert Layer Allowed Overlap With Existing Timeline

Problem:

```text
insertScheduledEvent()
```

validated hard time locks and duplicates, but did not reject a new card-window event that overlapped:

- an existing `scheduledEvents` window
- an `activeCards[].scheduledWindow`

Fix:

```text
lib/server/time-guardian/scheduled-event-inserter.ts
```

now rejects inserted events that overlap existing internal events or active scheduled cards.

Regression tests:

```text
tests/server/time-guardian/scheduled-event-inserter.test.ts
```

### 2. Queue Validator Allowed Timeline Occupancy Collisions

Problem:

```text
validateQueueAction()
```

checked hard locks but not existing internal timeline occupancy, so model proposals or stale queue actions could bypass planner protection.

Fix:

```text
lib/server/time-guardian/queue-action-validator.ts
```

now rejects `insert-schedule-event`, `schedule-card`, and `defer-card` actions that overlap existing `scheduledEvents` or active scheduled card windows.

Regression tests:

```text
tests/server/time-guardian/queue-action-validator.test.ts
```

## Verification

Focused Time Guardian/timeline suite:

```text
pnpm test tests/server/time-guardian/scheduled-event-inserter.test.ts tests/server/time-guardian/queue-action-validator.test.ts tests/server/timeline-complexity/mvp-regression-50-time-guardian.test.ts tests/server/timeline-complexity/agent1-agent2-timeline-complexity.test.ts tests/server/simulation/full-timeline-simulation.test.ts
```

Result:

```text
5 files passed
166 tests passed
```

Full suite:

```text
pnpm test
```

Result:

```text
72 files passed
469 tests passed
```

Static checks:

```text
pnpm typecheck
pnpm lint
pnpm build
```

Result:

```text
typecheck passed
lint passed
build passed
```

## Remaining Limits

- These 100 cases use deterministic synthetic schedule overlays derived from oracle metadata. They do not call real OCR or real MiMo.
- The corpus JSON does not contain full normalized time fields, so relative-date and conflict semantics are mapped from oracle phrases.
- This verifies Time Guardian behavior after facts are confirmed; it does not replace input-layer review gate or real multimodal extraction tests.

## Next Useful Expansion

- Run real MiMo over the same 50 images and save normalized extraction output.
- Convert real extraction output into `PlanCompilerHandoff` / confirmed schedule overlays.
- Re-run the same 100-case Time Guardian harness against real extracted time candidates.

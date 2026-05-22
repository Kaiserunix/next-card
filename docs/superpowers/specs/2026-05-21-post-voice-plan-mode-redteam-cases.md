# Post-Voice Plan Mode Redteam Cases

Date: 2026-05-21
Status: implementation audit cases

These cases protect the boundary:

```text
PlanCompilerHandoff -> PlanModeDraft(A/B/C) -> future Deck Commit Service
```

Plan Mode must not commit decks, write proof, create reminders, enqueue Time Guardian actions, or select a plan.

## Covered In Tests

1. Regeneration must create a new draft id and preserve `previousPlanModeDraftId`.
2. Regeneration must keep the same `PlanCompilerHandoff` authority instead of falling back to raw transcript text.
3. Provider output with four options is rejected.
4. Provider output with only two options is rejected.
5. Provider output containing a selected option marker is rejected.
6. Provider output with `deckCommitted=true` is rejected.
7. Provider output with `proofWritten=true` is rejected.
8. Provider output with `remindersCreated=true` is rejected.
9. Provider output with `scheduleQueued=true` is rejected.
10. Broad card output such as `完成作业` is rejected.
11. `voice-confirmed` requests without `confirmedTranscriptId` are rejected.
12. Provider output that invents normalized deadline authority is rejected.
13. Route/service imports are checked so plan-mode does not wire proof, reminder, schedule, or deck commit writers.

## Manual Review Notes

- Raw transcript text can be trace metadata, but never the planning authority.
- `missingButNonBlocking` may be carried forward, but provider output must not silently convert it into a hard deadline, location, reminder, or queued schedule action.
- If a future real provider is added, its output must pass the same validator before repository save.

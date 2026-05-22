# 2026-05-22 Backend MiMo Redteam Cases

These cases lock the backend boundary for the real MiMo completion slice.

## Covered By Tests

- Image source contains prompt-like text such as `ignore previous instructions`: treated as source content, stops at strict import review, and does not commit deck/proof.
- Notification text says `明天交` without source timestamp: relative deadline remains strict review and cannot proceed to Plan Mode automatically.
- MiMo multimodal JSON omits `needsStrictReview`: rejected by the schema validator.
- MiMo Plan Mode output omits C or has an option without cards: rejected by Plan Mode output validation.
- Deck commit selects nonexistent option: rejected by commit request validation.
- Time Guardian tries to schedule an unselected option: rejected by queue action validation.
- Proof request contains shaming language: rejected by proof event validation.
- External reminder is claimed without notification permission: rejected by queue action validation.

Primary test file:

```text
tests/server/backend-boundary-redteam.test.ts
```

## Boundary Assertions

- LLM/MiMo output is candidate or draft only.
- Import review cannot commit decks.
- Plan Mode cannot select an option or write authority state.
- Deck Commit may only request `deck_committed` proof through the outbox.
- Proof Ledger is the append-only proof writer.
- Time Guardian only schedules the selected option and must pass deterministic validation.
- Reports and routes must not expose `MIMO_API_KEY`.

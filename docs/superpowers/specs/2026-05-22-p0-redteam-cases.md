# 2026-05-22 P0 Backend Closure Redteam Cases

These cases lock the P0 backend boundary after strict review confirmation, Card Runtime, Proof Timeline, sandbox chain, and document text extraction.

Automated coverage lives in:

```text
tests/server/p0-backend-boundary-redteam.test.ts
tests/server/import-review/import-confirmation-service.test.ts
tests/server/card-runtime/card-runtime-boundary-redteam.test.ts
tests/server/proof-ledger/proof-timeline-projection.test.ts
tests/server/backend-orchestrator/sandbox-run-time-inputs.test.ts
tests/api/backend/import/import-route-document.test.ts
```

## Cases

| Case | Expected result |
|---|---|
| Strict image import without confirmation | Stops at Import Review; no Plan Mode draft, deck, proof, or reminder write. |
| Strict image import after confirmation | Produces `VerifiedInputBundle` and `PlanCompilerHandoff` with `mustGenerateABC: true`. |
| Notification says `明天交` without enough source-time certainty | Requires review for relative date; does not silently verify deadline. |
| PDF/DOCX prompt-like text | Treated as source content; cannot write deck/proof/reminder/profile. |
| No selected option | Deck Commit does not run; no default option A. |
| Selected option B | Only B cards are committed and scheduled; A/C do not appear in queue actions. |
| Direct `card_completed` proof write | Rejected unless `sourceService` is `card-runtime`. |
| Freeze action | Card remains in committed deck; runtime state becomes frozen and returns recovery/requeue action. |
| Burn action | Recorded as pressure feedback; no shame, punishment, failure, or diagnosis copy. |
| Missing notification permission | External reminder claims are rejected. |
| Proof Timeline write attempt | `POST /api/backend/proof/timeline` returns 405; timeline is read-only. |
| Reports/export payloads | Do not contain `MIMO_API_KEY`, Bearer token, or data URL strings. |

## Manual Smoke

```powershell
pnpm backend:chain -- --case strict-image-confirmed --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --selected-option plan-b
pnpm backend:chain -- --case crowded-timeline --selected-option plan-b
```

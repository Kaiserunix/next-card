# Next Card PM Q&A Track

## Purpose

This track is for product alignment only. It owns questions, decisions, specs, and implementation plans. It must not implement product code.

## Source Files

- `AGENTS.md`
- `docs/superpowers/specs/2026-05-21-nextcard-pm-question-log.md`
- `docs/superpowers/specs/2026-05-21-voice-plan-mode-backend-design.md`
- `external/next-card-119`

## Current Confirmed Baseline

- Product feeling: user speaks lightly, then the app plans.
- Explicit Plan Mode remains mandatory.
- `只做一张卡` is low-pressure input copy only.
- Student course/assignment scenarios lead the first redesign.
- Formal deck gestures use the old baseline.
- Burning is pressure feedback only, never failure or hard lock.
- Proof uses `今日证据` as a friendly entrance into the full evidence system.
- First backend slice is voice-only.
- Execution should follow written plans, not fresh improvisation.

## PM Responsibilities

- Keep `AGENTS.md` and PM question logs synchronized when decisions change.
- Inspect `external/next-card-119` when evaluating frontend inspiration.
- Convert decisions into specs or implementation plans.
- Preserve product boundaries: no Todo-list deck, no dashboard-first proof, no default `方案一`.
- Ask compact batches of questions when several decisions are independent.

## Remaining Q&A Areas

These are not blockers for the voice-backend implementation plan.

- Voice opening UI choreography: permission moment, card emergence, logo timing, first transcript card, and software-agent-driven clarification. Selected as the next PM planning focus.
- Exact visual redesign rules after the teammate frontend is reconciled.
- Android native wrapper timing: when to bridge native speech recognition.
- Future Plan Mode backend scope after the voice slice is complete.
- Future proof export/download behavior beyond copyable summary.
- Physical Android WebView tuning for drag thresholds and audio feedback.

## PM Output Contract

Every PM answer batch should update one of:

- `docs/superpowers/specs/2026-05-21-nextcard-pm-question-log.md`
- a new dated spec under `docs/superpowers/specs/`
- a new dated implementation plan under `docs/superpowers/plans/`

Do not leave decisions only in chat.

## Next PM Prompt

```text
Voice opening UI choreography has enough decisions for a design spec and implementation plan. Next PM question should move to teammate frontend reconciliation or post-voice Plan Mode backend.
```

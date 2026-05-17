# Backend Real Usage Simulation Report

Date: 2026-05-17

Scope: end-to-end usage simulation for the current Next Card backend and
browser shell. The run covered Plan Mode multi-turn context, multimodal import
review, large multi-goal import, hidden backlog dealing, schedule planning,
freeze return, provider dispatch, and the real input-to-deck-to-proof web path.

## Parallel Lanes

| Lane | Area | Result |
|---|---|---|
| Worker A | Future course timetable import | Added usage simulation for review gate, coverage checks, 1-2 dealt cards, hidden backlog, and later worker reveal |
| Worker B | Large multi-goal import | Added usage simulation for course/deadline/reminder coverage, hard locks, hidden backlog, and idempotent worker reveal/deal |
| Worker C | Plan Mode multi-turn context | Added usage simulation for 3-5 supplement turns and the 20-message boundary; fixed context facts not making vague goals buildable |
| Worker D | Freeze return and providers | Added usage simulation for freeze wait/remind/split behavior, Web Push failed shape, ICS calendar create/update, and hard locks |
| Worker E | Browser WebView smoke | Added Playwright smoke for input/deck/proof visibility and the real "go to math class" deck path |
| Main thread | Runtime API smoke | Exercised live `http://127.0.0.1:3001/api/backend/*` routes across planning, import review, schedule, and worker tick |

## Real Issues Fixed

1. Plan Mode treated a vague original input as still incomplete even when
   follow-up context already named the course, classroom, time, and materials.
   `createPlanModeTurn()` now evaluates concrete goal and timing against
   `inputText + context.facts`.
2. Import coverage classified some mixed lines incorrectly:
   - "course group notice: math class" must remain a course, not a reminder.
   - "finish homework before 20:30" must be a deadline.
   - reminder lines mentioning lab clothing must not become lab courses.
3. Schedule planning only created calendar events for `calendarSync: "wanted"`.
   It now emits `update-calendar-event` for `calendarSync: "synced"`.

## Usage Scenarios Covered

### Plan Mode Context

- Vague first input can remain structured without open chatbot questions.
- User supplements can persist across several turns.
- Once facts are enough, the backend returns `ready-to-build`.
- At the 20-message boundary, the service stops trimming beyond the allowed
  context and still returns structured default build/supplement choices.

### Multimodal Import Review

- Future timetable input produces a required review gate.
- Top-level card coverage includes courses, deadlines, and reminders.
- Only the first one or two cards are dealt immediately.
- Remaining cards enter hidden backlog and later require review before reveal.
- Output avoids standalone OCR wording; the import lane is modeled as
  multimodal parsing.

### Large Multi-Goal Import

- A 12-line mixed import produces 12 top-level cards.
- Courses, deadlines, reminders, and fixed personal appointments are preserved.
- The initial deal still exposes only 1-2 cards.
- Hard-locked notebook/calendar items are not silently moved.
- Repeated worker ticks are idempotent after actions are marked processed.

### Freeze Return

- Frozen cards stay in the backend queue instead of becoming a simple timeout.
- Before `returnAfter`, the worker keeps waiting.
- When urgent active work exists, the frozen card gets a reminder rather than
  stealing the top slot.
- In a clear window, the agent can split a frozen card into a smaller reentry
  card.

### Provider Dispatch

- Web Push with missing VAPID configuration reports `failed` honestly.
- ICS calendar provider creates and updates local calendar event files.
- Worker-dispatched calendar actions preserve hard time locks.

### Browser Web Path

- The page is not blank.
- Top modes remain exactly `input`, `deck`, and `proof`.
- The user can enter the math-class goal and reach a generated flow.
- The deck surface shows a focused single card, not a todo list.
- Proof shows summary and action record evidence.

Evidence artifacts:

- `test-results/usage-sim-webview/dom-evidence.json`
- `test-results/usage-sim-webview/01-input-empty.png`
- `test-results/usage-sim-webview/02-plan-flow.png`
- `test-results/usage-sim-webview/03-deck-single-card.png`
- `test-results/usage-sim-webview/04-proof-records.png`

## Runtime API Smoke

Live target: `http://127.0.0.1:3001`.

Observed output:

```text
health.ai: local-fallback
health.configured: false
plannerModel: mimo-v2.5-pro
multimodalModel: mimo-v2.5

direct Plan Mode: ready-to-build
multi-turn Plan Mode: ready-to-build, missingInformation=[]
import review: course, course, course, deadline, reminder
dealNowCards: 2
hiddenBacklogCards: 3
schedule: update-calendar-event emitted for synced calendar item
schedule: hard lock conflict preserved, no locked move-task
worker: update-calendar-event, create-calendar-event, reveal-hidden-goal, deal-card, deal-card
provider dispatch: calendar:updated, calendar:created
```

## Final Verification

```bash
pnpm test
# 36 files passed, 288 tests passed

pnpm lint
# passed

NEXT_CARD_E2E_PORT=3001 NEXT_CARD_E2E_SKIP_WEB_SERVER=1 \
  pnpm exec playwright test tests/e2e/usage-sim-webview.spec.ts --project=mobile-chrome
# 1 passed

pnpm build
# passed
```

Build still prints the existing local Node warning:

```text
--localstorage-file was provided without a valid path
```

During browser verification, an old dev server instance returned HTML while its
Next.js static chunks were 404. Restarting the dev server and keeping live
server logs outside `test-results` restored hydration and prevented Playwright
from hanging while clearing output artifacts.

## New Test Files

- `tests/server/usage-sim-course-import.test.ts`
- `tests/server/usage-sim-large-multi-goal.test.ts`
- `tests/server/usage-sim-plan-mode-context.test.ts`
- `tests/server/usage-sim-freeze-provider.test.ts`
- `tests/e2e/usage-sim-webview.spec.ts`

## Remaining Integration Notes

- The runtime still reports `health.providers.ai.configured=false` until
  `.env.local` provides a Mimo API key. No secret was written during this run.
- The browser smoke covers the current UI shell and local deterministic deck
  path. The real backend remains pluggable through `lib/server/backend-ports.ts`
  and `app/api/backend/*`.
- The current provider implementation verifies local Web Push/ICS shapes. A
  production notification/calendar provider can replace those ports without
  changing the planner contracts.
- Playwright can now run against an already-open local browser/dev server by
  setting `NEXT_CARD_E2E_SKIP_WEB_SERVER=1`.

## 2026-05-17 Rerun: Real Image Timetable

Input file:

- `C:/Users/qwerf/Downloads/66aa4560bbb1fd0251f0ac99bd42c845.jpg`

Additional backend gap fixed:

1. `POST /api/backend/import/review` now accepts direct image payloads through
   `imageDataUrl` or `imageBase64`.
2. When no Mimo multimodal provider is configured and no `rawText` hint is
   supplied, direct image import returns an honest `503` instead of pretending
   the local fallback inspected the image.
3. `createMimoImportParser()` now sends image payloads as OpenAI-compatible
   `image_url` message content to `mimo-v2.5`.
4. Large hidden timetable reveal is throttled to `maxDealCards`, so schedule
   and worker ticks expose only 1-2 hidden review candidates at a time.

Runtime API simulation on `http://127.0.0.1:3001`:

```text
health.ai: local-fallback
health.configured: false

direct image only:
  status: 503
  reason: configured multimodal provider or rawText hint required

image + extracted timetable text:
  topLevel: 11
  kinds: course
  dealNow: 2
  hiddenBacklog: 9
  conflicts: 0

schedule:
  reveal-hidden-goal: 2
  deal-card: 2
  create-calendar-event: 2

worker:
  reveal-hidden-goal: 2
  deal-card: 2
  dispatch: notification:failed, calendar:created
```

Regression added:

- `tests/server/usage-sim-real-image-timetable.test.ts`

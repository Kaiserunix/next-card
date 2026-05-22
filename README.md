# Next Card

Next Card is a demo-ready Web MVP for turning a one-sentence goal, written plan,
attachment, notification, or timetable into an AI-planned task card deck.

The first implementation pass is now a runnable Next.js app with a mobile-only
WebView shape and a backend service layer. The visible frontend loop is usable,
while current work focuses on production-facing backend capabilities: structured
Plan Mode, import review, priority scheduling, freeze return, worker ticks, and
pluggable notification/calendar/database ports.

## Run

```bash
pnpm install
pnpm dev
```

Then open:

```text
http://127.0.0.1:3000
```

Before handing off a change, run:

```bash
pnpm lint
pnpm test
pnpm build
```

Backend-only chain smoke without a dev server:

```bash
pnpm backend:chain -- --case text-assignment --selected-option plan-b
pnpm backend:chain -- --case crowded-timeline --selected-option plan-b
```

This repo now uses a Next.js server runtime because `app/api/backend/*` routes
are part of the product surface. Static `out/` exports are historical artifacts,
not the current backend-capable run target.

## Current Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zustand with localStorage persistence
- Framer Motion
- lucide-react
- Playwright as a dev-only smoke-test helper

Vitest covers the local backend state machine and mock AI contract; Playwright is reserved for small mobile WebView smoke flows.

The AI output contract is documented in:

```text
docs/AI-BEHAVIOR.md
```

Use it together with `docs/backend-extension-boundaries.md` before replacing
local fallback planning, multimodal import parsing, persistence, reminders, or calendar
behavior.

Core backend services are present under `lib/server/*`. Web Push, iCalendar,
and Mimo OpenAI-compatible AI providers are wired; login, production database,
and cloud storage are outside the current slice.

## Backend API Surface

Current route handlers:

```text
POST /api/backend/voice/transcribe
POST /api/backend/voice/normalize
POST /api/backend/voice/readiness
POST /api/backend/voice/confirm
POST /api/backend/import
POST /api/backend/import/confirm
POST /api/backend/plan-mode
POST /api/backend/deck/commit
POST /api/backend/card/action
GET  /api/backend/proof/timeline
POST /api/backend/sandbox/run
```

Core backend modules:

```text
lib/server/backend-ports.ts
lib/server/import-review/*
lib/server/input-layer/*
lib/server/plan-mode/*
lib/server/deck-commit/*
lib/server/card-runtime/*
lib/server/proof-ledger/*
lib/server/time-guardian/*
lib/server/backend-orchestrator/*
```

Agent runtime relationships are documented in:

```text
docs/agent-runtime-architecture.md
```

## Voice Backend Slice

The first backend-capable slice covers voice input only:

- `POST /api/backend/voice/transcribe`
- `POST /api/backend/voice/normalize`
- `POST /api/backend/voice/readiness`
- `POST /api/backend/voice/confirm`

The experience version uses Volcengine ASR through `VOLCENGINE_ASR_API_KEY` and `VOLCENGINE_ASR_RESOURCE_ID=volc.bigasr.auc_turbo`.

Limits:

- 30 seconds per clip
- 30 clips per anonymous device per day
- 10 total minutes per anonymous device per day

The backend stores voice usage records and confirmed transcript metadata in local JSON. Deck and proof state remain frontend `localStorage` state in this slice.

## Post-Voice Plan Mode Backend

Confirmed voice/manual/text/multimodal input now enters a draft-only backend boundary:

```text
voice confirm -> input-layer handoff -> plan-mode draft -> selected deck commit -> card runtime -> proof timeline
```

Route:

```text
POST /api/backend/plan-mode
```

The route accepts a verified `PlanCompilerHandoff` and returns a `PlanModeDraft`
with explicit A/B/C options. It stores drafts in:

```text
.nextcard-data/plan-mode-drafts.json
```

Config:

```text
NEXTCARD_PLAN_MODE_DRAFT_FILE=.nextcard-data/plan-mode-drafts.json
```

This route intentionally does not commit a deck, write proof, create reminders,
schedule cards, or default to option A. Deck Commit references `planModeDraftId`
plus the user's selected option, while Card Runtime owns card completion proof.

## Real Mimo AI Provider

Plan Mode uses `MIMO_PLANNER_MODEL` and multimodal import review uses
`MIMO_MULTIMODAL_MODEL` when `MIMO_API_KEY` is present. Without a key, both
ports fall back to deterministic local behavior.

```text
MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
MIMO_API_KEY=
MIMO_PLANNER_MODEL=mimo-v2.5-pro
MIMO_MULTIMODAL_MODEL=mimo-v2.5
MIMO_TIMEOUT_MS=30000
NEXT_CARD_AI_STRICT=false
```

The browser composer also calls `/api/backend/plan-mode` after local deck
creation and merges returned model analysis into the visible plan summary.

## Real Push And Calendar Providers

Push provider: Web Push / VAPID.

```text
NEXT_CARD_PUSH_VAPID_SUBJECT=mailto:admin@example.com
NEXT_CARD_PUSH_VAPID_PUBLIC_KEY=...
NEXT_CARD_PUSH_VAPID_PRIVATE_KEY=...
NEXT_CARD_PUSH_SUBSCRIPTIONS_FILE=optional path
```

The browser reads `GET /api/backend/push/public-key`, creates a
`PushSubscription`, then posts that JSON to `POST /api/backend/push/subscriptions`.
Reminder actions from the worker are dispatched through the same provider.

Calendar provider: iCalendar / `.ics`.

```text
NEXT_CARD_CALENDAR_DIR=optional path
NEXT_CARD_CALENDAR_NAME=Next Card
NEXT_CARD_CALENDAR_DEFAULT_DURATION_MINUTES=25
```

Calendar actions write deterministic `.ics` files that common calendar clients
can import.

## Mobile WebView Target

This project is now mobile-only by design.

Web target contract:

```text
lib/webview-contract.ts
```

Current decisions:

- The app renders as a single mobile WebView surface.
- Desktop browsers only preview a centered `430px` maximum-width app frame.
- There are no desktop two-column layouts.
- The root viewport uses `viewport-fit=cover` and CSS safe-area env values.
- The UI supports practical Android widths from `360px` upward.
- State persists through `localStorage`, so Android WebView must enable DOM storage.
- The Next build runs with server API routes for backend-capable WebView testing.

Android wrapper requirements:

```kotlin
webView.settings.javaScriptEnabled = true
webView.settings.domStorageEnabled = true
webView.settings.loadWithOverviewMode = true
webView.settings.useWideViewPort = true
```

If the Android wrapper needs the backend-capable build, load an HTTPS or local
LAN deployment of the Next.js server. A purely static local asset bundle will not
include `app/api/backend/*`.

Do not add desktop breakpoints or dashboard-style layouts. Any new page or
component should be designed inside the same mobile WebView frame first.

## Product Modes

The app intentionally exposes exactly three top-level modes:

```text
input / deck / proof
```

The mode switch is implemented in:

```text
app/page.tsx
components/TopModeTabs.tsx
```

Do not add a fourth primary mode without revisiting the product contract in
`AGENTS.md`.

The visible app shell is implemented in:

```text
app/page.tsx
app/globals.css
app/layout.tsx
```

Keep this shell mobile-only. If a teammate needs a desktop demo, use the centered
preview frame rather than adding separate desktop UI.

## Page Interface Contracts

Page contracts live in:

```text
lib/page-contracts.ts
```

That file defines the handoff interfaces for each mode:

- `InputPagePort`
- `DeckPagePort`
- `ProofPagePort`
- `PAGE_CONTRACTS`
- `NEXT_IMPLEMENTATION_BACKLOG`

Use these as the source of truth when adding the next feature. If a new action is
added to a page, add or update the corresponding action contract there first.

## Input Page Contract

Status: mostly implemented.

Owner files:

```text
components/input/InputComposer.tsx
components/input/PlanModePanel.tsx
components/input/PlanOptionCard.tsx
components/flow/TaskFlowOverview.tsx
lib/mock-ai.ts
store/useNextCardStore.ts
```

Current behavior:

- Accepts text goals.
- Adds mock attachment text.
- Adds mock image timetable text.
- Shows an analysis state before plan options.
- Extracts mock time information.
- Generates exactly three plans.
- Supports `否，重新生成`.
- Selecting a plan creates a task flow, deck entry, and first proof record.

Main actions:

- `submitInput`
- `regeneratePlans`
- `selectPlan`

Next work:

- Expand the composer from backend Plan Mode calibration to fully backend-owned deck generation.
- Wire real uploaded image bytes into `/api/backend/import/review`; current UI still uses mock attachment/image text.
- Keep the local fallback stable whenever Mimo is unavailable or `NEXT_CARD_AI_STRICT=false`.

## Deck Page Contract

Status: partial.

Owner files:

```text
components/deck/DeckLibrary.tsx
components/deck/CardTimeUI.tsx
store/useNextCardStore.ts
lib/mock-ai.ts
```

Current behavior:

- Shows generated deck covers.
- Opens a deck.
- Shows one active card execution surface.
- Shows estimated time, remaining window, urgency stage, and a time rail.
- `去高数课` creates a course-style deck with a near-deadline burning demo card.
- Double click starts timing with sparks and WebAudio fallback.
- Triple click or the burn button starts quick burning mode.
- Left/right drag or completion button completes the current card and writes proof.
- Down drag reveals the status bar.
- Deeper down drag or freeze button opens the freeze prompt and writes proof.

Implemented interfaces:

- `openDeck`
- `completeCurrentCard`
- `revealStatusBar`
- `requestFreezeCurrentCard`
- `startFocusTiming`
- `startQuickBurning`

Next work:

1. Tune drag thresholds on a physical Android WebView.
2. Add a real resume screen for `rescheduleQueue`.
3. Extract `BurnTimer` if the burn countdown becomes more detailed.
4. Improve reward-card transition after a full deck completes.

Recommended component files to add next:

```text
components/deck/BurnTimer.tsx
```

## Proof Page Contract

Status: partial.

Owner files:

```text
components/proof/ProofDashboard.tsx
store/useNextCardStore.ts
lib/mock-ai.ts
```

Current behavior:

- Shows proof stat cards.
- Shows a colored action table as mobile proof cards.
- Shows progress charts and a completion ring.
- Shows a readable summary document.
- Shows a proof03-style manually scrollable flow journal with fade edges.
- Receives records from plan selection, timing, burning, completion, freezing, and reward generation.

Interfaces left for the next teammate:

- `renderProofDashboard`
- `refreshSummary`
- `exportSummaryDocument`

Next work:

1. Split `ProofDashboard` into smaller components when the next proof iteration grows:
   ```text
   components/proof/ProofTable.tsx
   components/proof/ProofCharts.tsx
   components/proof/FlowJournal.tsx
   components/proof/JournalEntry.tsx
   components/proof/SummaryDocument.tsx
   ```
2. Add richer heat blocks once multiple days exist.
3. Add copy/export behavior for the summary document if needed for demos.

## Mock AI Contract

Local fallback AI lives in:

```text
lib/mock-ai.ts
```

Current functions:

- `mockAnalyzeInput`
- `mockGeneratePlanOptions`
- `mockRegeneratePlanOptions`
- `mockGenerateTaskFlow`
- `mockGenerateDeckFromPlan`
- `mockGenerateTimePlanForCard`
- `mockUpdateCardUrgency`
- `mockRescheduleFrozenCard`
- `mockGenerateProofSummary`

Keep these deterministic so backend/API work can fall back safely when provider
adapters are unavailable.

Real AI provider adapters live in:

```text
lib/server/providers/mimo-ai-provider.ts
lib/client/plan-mode-client-adapter.ts
```

Backend extension boundaries are documented in:

```text
docs/backend-extension-boundaries.md
```

Use that boundary map before changing multimodal import parsing, AI planning, backend persistence,
reminders, calendar sync, or proof export.

## State Contract

Shared types live in:

```text
lib/types.ts
```

Zustand store lives in:

```text
store/useNextCardStore.ts
```

The store currently owns:

- `mode`
- `inputs`
- `analysis`
- `plans`
- `taskFlow`
- `deck`
- `proofs`

When adding a feature, prefer adding a named store action instead of mutating
nested state directly inside UI components.

## Suggested Next PR

Tune the deck execution surface on real mobile WebView.

Minimum scope:

1. Run the backend-capable Next.js app from a reachable HTTPS/LAN URL.
2. Test drag thresholds, double click, triple click, and WebAudio on device.
3. Add native back-button handling for `input / deck / proof` mode history.
4. Add a resume screen for frozen cards in `rescheduleQueue`.
5. Run `pnpm lint`, `pnpm test`, and `pnpm build`.

Do not bypass `lib/server/backend-ports.ts` when adding multimodal import parsing, AI planning,
database, reminders, or calendar sync. Keep the local fallback path working while
provider adapters are added.

## Suggested APK Wrapper Work

This repo only ships the WebView page. Android packaging should happen in a
separate native wrapper project or a later `android/` folder.

Recommended Android-side steps:

1. Run `pnpm build`.
2. Deploy/run the Next.js server target for backend-capable API routes.
3. Create a single-Activity WebView wrapper.
4. Enable JavaScript and DOM storage.
5. Load the local `index.html` or hosted URL.
6. Set the status/navigation bar colors to match `#fbf1ea`.
7. Preserve safe-area/inset behavior and avoid injecting desktop viewport rules.
8. Later add a bridge only for reminders, calendar, notifications, sound, and
   native back-button behavior.

## Known Dirty Worktree Note

The repository may already show deleted static proof preview files and an
`archive/` folder from earlier prototype cleanup. Those are unrelated to the
current app implementation. Do not restore or delete them unless the owner asks.

## License

MIT

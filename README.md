# Next Card

Next Card is a demo-ready Web MVP for turning a one-sentence goal, written plan,
attachment, notification, or timetable into an AI-planned task card deck.

The first implementation pass is now a runnable Next.js app. The current focus is
the `input` experience: a calm Pi-inspired composer, mock Plan Mode analysis,
three execution plans, task-flow generation, a generated deck cover, and an
initial proof record.

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
pnpm build
```

## Current Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zustand with localStorage persistence
- Framer Motion
- lucide-react
- Playwright as a dev-only smoke-test helper

No real OCR, OpenAI API, backend, auth, reminders, calendar sync, or notification
service is connected yet.

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

- Keep mock planning stable while the deck interaction is built.
- Later replace `mockAnalyzeInput` and plan generation with a real planning API.
- When real OCR arrives, connect it through the existing `imageSchedule` and
  `parsedText` fields instead of creating a separate page.

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
- Shows one active card preview.
- Shows estimated time, remaining window, urgency stage, and a time rail.
- `去高数课` creates a course-style deck with a near-deadline burning demo card.

Interfaces left for the next teammate:

- `openDeck`
- `completeCurrentCard`
- `revealStatusBar`
- `requestFreezeCurrentCard`
- `startFocusTiming`
- `startQuickBurning`

Next work:

1. Create `components/deck/SwipeTaskCard.tsx`.
2. Move the active-card preview from `DeckLibrary` into `SwipeTaskCard`.
3. Use Framer Motion drag gestures:
   - right swipe: complete current card
   - left swipe: complete current card
   - down swipe: show `DeckStatusBar`
   - deeper down swipe: show `FreezePrompt`
4. Add store actions for card completion, freeze, reschedule, timing, and burning.
5. Write proof records for completion, burning, freeze, reschedule, and reward.
6. When all cards complete, show a reward card and add it to `deck.rewardCards`.

Recommended component files to add next:

```text
components/deck/SwipeTaskCard.tsx
components/deck/BurnTimer.tsx
components/deck/DeckStatusBar.tsx
components/deck/FreezePrompt.tsx
components/deck/RewardCard.tsx
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
- Shows a colored action table.
- Shows a readable summary document.
- Receives the first proof record when a plan is selected.

Interfaces left for the next teammate:

- `renderProofDashboard`
- `refreshSummary`
- `exportSummaryDocument`

Next work:

1. Split `ProofDashboard` into smaller components:
   ```text
   components/proof/ProofTable.tsx
   components/proof/ProofCharts.tsx
   components/proof/FlowJournal.tsx
   components/proof/JournalEntry.tsx
   components/proof/SummaryDocument.tsx
   ```
2. Add the required blog-style chronological flow journal.
3. Add progress ring, bar progress, heat blocks, or compact stat charts.
4. Update proof records from deck events, not only plan selection.
5. Add copy/export behavior for the summary document if needed for demos.

## Mock AI Contract

All mock AI lives in:

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

Keep these deterministic. The MVP should feel smart, but it should not call real
AI services yet.

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

Build the deck execution surface.

Minimum scope:

1. Add `SwipeTaskCard`.
2. Add left/right swipe completion.
3. Add double-click timing sparks.
4. Add triple-click quick burning mode.
5. Add down-swipe status bar.
6. Add deeper down-swipe freeze prompt.
7. Update proof records from those actions.
8. Run `pnpm lint` and `pnpm build`.

Do not start real OCR, OpenAI API, backend, reminders, or calendar sync until the
mock deck loop is complete and demo-stable.

## Known Dirty Worktree Note

The repository may already show deleted static proof preview files and an
`archive/` folder from earlier prototype cleanup. Those are unrelated to the
current app implementation. Do not restore or delete them unless the owner asks.

## License

MIT

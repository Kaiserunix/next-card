# Next Card Backend Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current local "backend" surface of Next Card into a tested, stable state machine, then add the missing backend behaviors needed before real OCR, OpenAI, reminders, calendar sync, or cloud persistence.

**Architecture:** This MVP has no real API server yet. The backend surface is `lib/mock-ai.ts`, `store/useNextCardStore.ts`, persisted Zustand state, page contracts, and future service boundaries. Tests should lock the mock planning, deck execution, proof writing, time state, freeze/resume, and persistence behavior before any real service integration.

**Tech Stack:** Next.js App Router, TypeScript, Zustand, localStorage persistence, Vitest for unit/store tests, Playwright for minimal smoke tests, GitHub Actions for CI.

---

## Current Backend Surface

- `lib/mock-ai.ts`: deterministic mock planning, task flow, deck generation, urgency, freeze reschedule, proof summary.
- `store/useNextCardStore.ts`: state machine for input, analysis, plan selection, deck actions, proof events, reward cards, persistence.
- `lib/types.ts`: shared domain types.
- `lib/page-contracts.ts`: page action contracts and integration backlog.
- `lib/webview-contract.ts`: Android WebView storage and static export contract.
- `package.json`: currently has `dev`, `lint`, `build`; no `test` script yet.
- `.github/`: currently has CODEOWNERS only; no CI workflow yet.

## File Structure To Create Or Modify

- Modify: `package.json`
  - Add Vitest scripts and dev dependencies.
- Create: `vitest.config.ts`
  - Configure TypeScript path alias and jsdom localStorage support.
- Create: `tests/setup.ts`
  - Reset timers and localStorage between tests.
- Create: `tests/helpers/nextCardStore.ts`
  - Provide store reset and common flow helpers.
- Create: `tests/lib/mock-ai.test.ts`
  - Unit tests for mock analysis, plans, decks, urgency, freeze, summary.
- Create: `tests/store/planning-flow.test.ts`
  - Store tests for input, analysis, regeneration, plan selection.
- Create: `tests/store/deck-actions.test.ts`
  - Store tests for timing, burning, complete, freeze, reward.
- Create: `tests/store/persistence.test.ts`
  - Tests for Zustand persisted state shape.
- Create: `lib/card-time-engine.ts`
  - Testable time refresh helper that wraps card urgency recalculation.
- Create: `tests/lib/card-time-engine.test.ts`
  - Tests for refreshing active and queued card time state.
- Modify: `store/useNextCardStore.ts`
  - Add `refreshActiveDeckTime` and `resumeFrozenCard`.
- Create: `tests/store/time-and-reschedule.test.ts`
  - Tests for active deck time refresh and frozen-card resume.
- Create: `playwright.config.ts`
  - Minimal Web MVP smoke-test config.
- Create: `tests/e2e/mvp-flow.spec.ts`
  - Browser smoke test for input to proof loop.
- Create: `.github/workflows/ci.yml`
  - Run lint, unit tests, and build.
- Modify: `README.md`
  - Document `pnpm test` and backend test boundaries.

---

### Task 1: Add Test Runner Foundation

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Install test dependencies**

Run:

```bash
pnpm add -D vitest jsdom
```

Expected: `package.json` and `pnpm-lock.yaml` include `vitest` and `jsdom`.

- [ ] **Step 2: Add test scripts**

Modify `package.json` scripts to this exact shape:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint . --ext .ts,.tsx",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
```

- [ ] **Step 4: Create test setup**

Create `tests/setup.ts`:

```ts
import { afterEach, vi } from "vitest";

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
```

- [ ] **Step 5: Run empty test suite**

Run:

```bash
pnpm test
```

Expected: Vitest starts successfully and reports no matching tests or an empty passing suite, depending on Vitest version.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts tests/setup.ts
git commit -m "test: add vitest foundation"
```

---

### Task 2: Unit-Test Mock AI Planning And Deck Generation

**Files:**
- Create: `tests/lib/mock-ai.test.ts`
- Read: `lib/mock-ai.ts`
- Read: `lib/types.ts`

- [ ] **Step 1: Write failing tests for mock analysis and deck generation**

Create `tests/lib/mock-ai.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  mockAnalyzeInput,
  mockGenerateDeckFromPlan,
  mockGeneratePlanOptions,
  mockGenerateProofSummary,
  mockGenerateTaskFlow,
  mockRegeneratePlanOptions,
  mockRescheduleFrozenCard,
  mockUpdateCardUrgency
} from "@/lib/mock-ai";
import type { InputsState, ProofRecord } from "@/lib/types";

const emptyInput: InputsState = {
  text: "",
  attachments: [],
  imageSchedule: null,
  parsedText: "",
  sourceType: "text"
};

describe("mock-ai", () => {
  it("analyzes one-sentence course goals with time constraints", () => {
    const analysis = mockAnalyzeInput({
      ...emptyInput,
      text: "去高数课"
    });

    expect(analysis.sourceType).toBe("text");
    expect(analysis.goalUnderstanding).toContain("去高数课");
    expect(analysis.goalUnderstanding).toContain("到课卡组");
    expect(analysis.constraints).toHaveLength(3);
    expect(analysis.stages).toEqual(["确认课程信息", "整理材料", "出门移动", "到达后课前准备"]);
    expect(analysis.deadlineLabel).toContain("最佳出门窗口");
    expect(analysis.suggestedStart).toContain("现在");
  });

  it("analyzes assignment notices from attachment text", () => {
    const analysis = mockAnalyzeInput({
      ...emptyInput,
      attachments: [
        {
          id: "attachment-1",
          name: "notice.txt",
          kind: "notice",
          mockedText: "课程作业通知：今晚 20:00 前提交一页简短分析。"
        }
      ],
      parsedText: "课程作业通知：今晚 20:00 前提交一页简短分析。",
      sourceType: "attachment"
    });

    expect(analysis.sourceType).toBe("attachment");
    expect(analysis.goalUnderstanding).toContain("最低可提交");
    expect(analysis.deadlineLabel).toBe("今晚 20:00 前");
    expect(analysis.timeStrategy.join(" ")).toContain("10 分钟");
  });

  it("generates exactly three plan options with required styles", () => {
    const analysis = mockAnalyzeInput({ ...emptyInput, text: "去高数课" });
    const options = mockGeneratePlanOptions(analysis);

    expect(options.map((option) => option.id)).toEqual(["plan-1", "plan-2", "plan-3"]);
    expect(options.map((option) => option.style)).toEqual(["urgent", "balanced", "gentle"]);
    expect(options.every((option) => option.steps.length >= 4)).toBe(true);
  });

  it("regenerates plans while preserving the original input intent", () => {
    const input = { ...emptyInput, text: "去高数课" };
    const previousOptions = mockGeneratePlanOptions(mockAnalyzeInput(input));
    const regenerated = mockRegeneratePlanOptions(input, previousOptions);

    expect(regenerated).toHaveLength(3);
    expect(regenerated[0].summary).toContain("重新生成");
    expect(regenerated[0].steps[0]).toContain("下一步");
  });

  it("generates a lightweight task flow from a selected plan", () => {
    const selected = mockGeneratePlanOptions(mockAnalyzeInput({ ...emptyInput, text: "去高数课" }))[0];
    const flow = mockGenerateTaskFlow(selected);

    expect(flow.title).toBe("方案一任务流");
    expect(flow.overallProgress).toBe(0);
    expect(flow.nodes).toHaveLength(4);
    expect(flow.nodes[0].status).toBe("active");
    expect(flow.edges).toEqual([
      { from: "flow-plan-1-1", to: "flow-plan-1-2" },
      { from: "flow-plan-1-2", to: "flow-plan-1-3" },
      { from: "flow-plan-1-3", to: "flow-plan-1-4" }
    ]);
  });

  it("generates a course deck with a burning first card for 去高数课", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T08:00:00.000Z"));

    const selected = mockGeneratePlanOptions(mockAnalyzeInput({ ...emptyInput, text: "去高数课" }))[0];
    const flow = mockGenerateTaskFlow(selected);
    const deck = mockGenerateDeckFromPlan(selected, flow, "去高数课");

    expect(deck.coverTitle).toBe("去高数课");
    expect(deck.coverIcon).toBe("course");
    expect(deck.cards.length).toBeGreaterThanOrEqual(4);
    expect(deck.cards[0]).toMatchObject({
      title: "确认高数课时间和教室",
      estimatedMinutes: 4,
      remainingSeconds: 480,
      urgencyStage: "burning",
      damageEffect: "burn",
      burnLevel: 3,
      status: "active"
    });
    expect(deck.cards[0].action).toContain("时间、地点");
  });

  it("updates card urgency according to deadline thresholds", () => {
    const selected = mockGeneratePlanOptions(mockAnalyzeInput({ ...emptyInput, text: "去高数课" }))[0];
    const flow = mockGenerateTaskFlow(selected);
    const deck = mockGenerateDeckFromPlan(selected, flow, "去高数课");
    const card = {
      ...deck.cards[0],
      deadlineAt: "2026-05-16T08:10:00.000Z"
    };

    expect(mockUpdateCardUrgency(card, new Date("2026-05-16T07:40:00.000Z")).urgencyStage).toBe("calm");
    expect(mockUpdateCardUrgency(card, new Date("2026-05-16T07:55:00.000Z")).urgencyStage).toBe("hot");
    expect(mockUpdateCardUrgency(card, new Date("2026-05-16T08:08:00.000Z")).urgencyStage).toBe("burning");
    expect(mockUpdateCardUrgency(card, new Date("2026-05-16T08:11:00.000Z")).urgencyStage).toBe("expired");
  });

  it("reschedules frozen cards without losing context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T08:00:00.000Z"));

    const selected = mockGeneratePlanOptions(mockAnalyzeInput({ ...emptyInput, text: "去高数课" }))[0];
    const flow = mockGenerateTaskFlow(selected);
    const deck = mockGenerateDeckFromPlan(selected, flow, "去高数课");
    const frozen = mockRescheduleFrozenCard(deck.cards[0], flow);

    expect(frozen.status).toBe("frozen");
    expect(frozen.damageEffect).toBe("freeze");
    expect(frozen.urgencyStage).toBe("calm");
    expect(frozen.cardBackNote).toContain("3 小时后");
  });

  it("generates a readable proof summary", () => {
    const proofs: ProofRecord[] = [
      {
        id: "proof-1",
        goalTitle: "去高数课",
        source: "text",
        status: "rewarded",
        progress: 100,
        completedCards: 4,
        frozenCards: 0,
        actualMinutes: 16,
        timeStatus: "burning-completed",
        timeDamageEvents: ["快速燃烧 4 分钟后完成"],
        lastDamageEffect: "burn",
        lastAction: "奖励卡生成",
        nextSuggestion: "复盘",
        createdAt: "2026-05-16T08:20:00.000Z"
      }
    ];

    expect(mockGenerateProofSummary(proofs)).toContain("1 条行动证据");
    expect(mockGenerateProofSummary(proofs)).toContain("燃烧节奏");
  });
});
```

- [ ] **Step 2: Run test and verify it fails if setup is missing**

Run:

```bash
pnpm test tests/lib/mock-ai.test.ts
```

Expected before Task 1 is complete: command fails because Vitest is missing. Expected after Task 1: tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/lib/mock-ai.test.ts
git commit -m "test: cover mock ai planning and deck generation"
```

---

### Task 3: Add Store Test Helpers

**Files:**
- Create: `tests/helpers/nextCardStore.ts`
- Read: `store/useNextCardStore.ts`
- Read: `lib/mock-ai.ts`

- [ ] **Step 1: Create a store reset helper**

Create `tests/helpers/nextCardStore.ts`:

```ts
import { mockGenerateProofSummary } from "@/lib/mock-ai";
import { useNextCardStore } from "@/store/useNextCardStore";

export function resetNextCardStore() {
  localStorage.clear();

  useNextCardStore.setState({
    mode: "input",
    inputs: {
      text: "",
      attachments: [],
      imageSchedule: null,
      parsedText: "",
      sourceType: "text"
    },
    analysis: null,
    analysisStatus: "idle",
    plans: {
      goalUnderstanding: "",
      constraints: [],
      timeStrategy: [],
      options: [],
      selectedPlanId: null,
      regenerateCount: 0
    },
    taskFlow: null,
    deck: {
      decks: [],
      activeDeckId: null,
      currentCardId: null,
      completedCardIds: [],
      frozenCardIds: [],
      rewardCards: [],
      rescheduleQueue: [],
      activeTimeMode: "idle"
    },
    proofs: {
      records: [],
      summaryDocument: mockGenerateProofSummary([])
    }
  });
}

export function generateCourseDeckInStore() {
  const store = useNextCardStore.getState();

  store.setInputText("去高数课");
  useNextCardStore.getState().analyzeInput();
  useNextCardStore.getState().finishAnalysis();
  useNextCardStore.getState().selectPlan("plan-1");

  const state = useNextCardStore.getState();
  const activeDeck = state.deck.decks.find((deck) => deck.id === state.deck.activeDeckId);

  if (!activeDeck) {
    throw new Error("Expected active deck after selecting plan-1");
  }

  return activeDeck;
}

export function getActiveCard() {
  const state = useNextCardStore.getState();
  const activeDeck = state.deck.decks.find((deck) => deck.id === state.deck.activeDeckId);
  const activeCard = activeDeck?.cards.find((card) => card.id === state.deck.currentCardId);

  if (!activeDeck || !activeCard) {
    throw new Error("Expected active deck and card");
  }

  return { activeDeck, activeCard };
}
```

- [ ] **Step 2: Run TypeScript through test command**

Run:

```bash
pnpm test tests/helpers/nextCardStore.ts
```

Expected: Vitest reports no tests in the helper file, but TypeScript import resolution should not crash.

- [ ] **Step 3: Commit**

```bash
git add tests/helpers/nextCardStore.ts
git commit -m "test: add next card store test helpers"
```

---

### Task 4: Test Planning Store Flow

**Files:**
- Create: `tests/store/planning-flow.test.ts`
- Read: `store/useNextCardStore.ts`
- Read: `tests/helpers/nextCardStore.ts`

- [ ] **Step 1: Write failing store flow tests**

Create `tests/store/planning-flow.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import { resetNextCardStore } from "../helpers/nextCardStore";

describe("planning store flow", () => {
  beforeEach(() => {
    resetNextCardStore();
  });

  it("stores text input and runs analysis before plan options", () => {
    useNextCardStore.getState().setInputText("去高数课");
    useNextCardStore.getState().analyzeInput();

    const state = useNextCardStore.getState();

    expect(state.inputs.text).toBe("去高数课");
    expect(state.inputs.sourceType).toBe("text");
    expect(state.analysisStatus).toBe("analyzing");
    expect(state.analysis?.goalUnderstanding).toContain("去高数课");
    expect(state.plans.options).toHaveLength(0);
    expect(state.taskFlow).toBeNull();
  });

  it("finishes analysis with exactly three plan options", () => {
    useNextCardStore.getState().setInputText("去高数课");
    useNextCardStore.getState().analyzeInput();
    useNextCardStore.getState().finishAnalysis();

    const state = useNextCardStore.getState();

    expect(state.analysisStatus).toBe("ready");
    expect(state.plans.options.map((option) => option.id)).toEqual(["plan-1", "plan-2", "plan-3"]);
    expect(state.plans.regenerateCount).toBe(0);
  });

  it("regenerates plans without clearing original input", () => {
    useNextCardStore.getState().setInputText("今晚 20:00 前提交作业");
    useNextCardStore.getState().analyzeInput();
    useNextCardStore.getState().finishAnalysis();
    useNextCardStore.getState().regeneratePlans();

    const state = useNextCardStore.getState();

    expect(state.inputs.text).toBe("今晚 20:00 前提交作业");
    expect(state.plans.options).toHaveLength(3);
    expect(state.plans.options[0].summary).toContain("重新生成");
    expect(state.plans.regenerateCount).toBe(1);
  });

  it("selecting a plan creates task flow, deck, and first proof record", () => {
    useNextCardStore.getState().setInputText("去高数课");
    useNextCardStore.getState().analyzeInput();
    useNextCardStore.getState().finishAnalysis();
    useNextCardStore.getState().selectPlan("plan-1");

    const state = useNextCardStore.getState();
    const deck = state.deck.decks[0];

    expect(state.plans.selectedPlanId).toBe("plan-1");
    expect(state.taskFlow?.nodes).toHaveLength(4);
    expect(deck.coverTitle).toBe("去高数课");
    expect(deck.coverIcon).toBe("course");
    expect(state.deck.activeDeckId).toBe(deck.id);
    expect(state.deck.currentCardId).toBe(deck.cards[0].id);
    expect(state.proofs.records[0]).toMatchObject({
      goalTitle: "去高数课",
      status: "in-progress",
      progress: 0,
      lastAction: "选择方案一并生成任务流"
    });
  });

  it("ignores invalid plan ids without mutating deck state", () => {
    useNextCardStore.getState().setInputText("去高数课");
    useNextCardStore.getState().analyzeInput();
    useNextCardStore.getState().finishAnalysis();
    useNextCardStore.getState().selectPlan("missing-plan" as "plan-1");

    const state = useNextCardStore.getState();

    expect(state.deck.decks).toHaveLength(0);
    expect(state.taskFlow).toBeNull();
    expect(state.proofs.records).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the planning flow tests**

Run:

```bash
pnpm test tests/store/planning-flow.test.ts
```

Expected: all tests pass after Task 1 and Task 3 are complete.

- [ ] **Step 3: Commit**

```bash
git add tests/store/planning-flow.test.ts
git commit -m "test: cover planning store flow"
```

---

### Task 5: Test Deck Actions, Freeze, Completion, And Rewards

**Files:**
- Create: `tests/store/deck-actions.test.ts`
- Read: `store/useNextCardStore.ts`
- Read: `tests/helpers/nextCardStore.ts`

- [ ] **Step 1: Write failing deck action tests**

Create `tests/store/deck-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import { generateCourseDeckInStore, getActiveCard, resetNextCardStore } from "../helpers/nextCardStore";

describe("deck action store flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T08:00:00.000Z"));
    resetNextCardStore();
    generateCourseDeckInStore();
  });

  it("opens an existing deck and points at the active card", () => {
    const deck = useNextCardStore.getState().deck.decks[0];
    useNextCardStore.getState().setMode("proof");
    useNextCardStore.getState().openDeck(deck.id);

    const state = useNextCardStore.getState();

    expect(state.mode).toBe("deck");
    expect(state.deck.activeDeckId).toBe(deck.id);
    expect(state.deck.currentCardId).toBe(deck.cards[0].id);
  });

  it("double click timing starts focus mode and writes proof", () => {
    const { activeCard } = getActiveCard();
    useNextCardStore.getState().startFocusTiming();

    const state = useNextCardStore.getState();
    const updatedCard = state.deck.decks[0].cards.find((card) => card.id === activeCard.id);

    expect(state.deck.activeTimeMode).toBe("timing");
    expect(updatedCard?.startedAt).toBe("2026-05-16T08:00:00.000Z");
    expect(state.proofs.records[0].lastAction).toContain("开始计时");
  });

  it("triple click burning mode marks the current card as burning and writes proof", () => {
    const { activeCard } = getActiveCard();
    useNextCardStore.getState().startQuickBurning();

    const state = useNextCardStore.getState();
    const updatedCard = state.deck.decks[0].cards.find((card) => card.id === activeCard.id);

    expect(state.deck.activeTimeMode).toBe("burning");
    expect(updatedCard?.urgencyStage).toBe("burning");
    expect(updatedCard?.damageEffect).toBe("burn");
    expect(updatedCard?.burnLevel).toBe(3);
    expect(state.proofs.records[0].timeDamageEvents).toContain("三击进入快速燃烧模式");
  });

  it("completes current card and advances to the next queued card", () => {
    const firstCardId = useNextCardStore.getState().deck.currentCardId;
    useNextCardStore.getState().completeCurrentCard("right");

    const state = useNextCardStore.getState();
    const deck = state.deck.decks[0];
    const completedCard = deck.cards.find((card) => card.id === firstCardId);
    const currentCard = deck.cards.find((card) => card.id === state.deck.currentCardId);

    expect(completedCard?.status).toBe("completed");
    expect(currentCard?.status).toBe("active");
    expect(deck.completedCards).toBe(1);
    expect(state.deck.completedCardIds).toContain(firstCardId);
    expect(state.proofs.records[0].lastAction).toContain("完成");
  });

  it("freezes current card, adds it to reschedule queue, and advances", () => {
    const firstCardId = useNextCardStore.getState().deck.currentCardId;
    useNextCardStore.getState().freezeCurrentCard();

    const state = useNextCardStore.getState();
    const deck = state.deck.decks[0];
    const frozenCard = deck.cards.find((card) => card.id === firstCardId);
    const currentCard = deck.cards.find((card) => card.id === state.deck.currentCardId);

    expect(frozenCard?.status).toBe("frozen");
    expect(frozenCard?.damageEffect).toBe("freeze");
    expect(currentCard?.status).toBe("active");
    expect(state.deck.frozenCardIds).toContain(firstCardId);
    expect(state.deck.rescheduleQueue).toContain(firstCardId);
    expect(state.deck.activeTimeMode).toBe("paused");
    expect(state.proofs.records[0]).toMatchObject({
      status: "frozen",
      timeStatus: "frozen-rescheduled",
      lastDamageEffect: "freeze"
    });
  });

  it("generates a reward card after completing every card in the deck", () => {
    while (useNextCardStore.getState().deck.currentCardId) {
      useNextCardStore.getState().completeCurrentCard("button");
    }

    const state = useNextCardStore.getState();
    const deck = state.deck.decks[0];

    expect(deck.deckStatus).toBe("completed");
    expect(deck.completedCards).toBe(deck.totalCards);
    expect(state.deck.rewardCards).toHaveLength(1);
    expect(state.deck.rewardCards[0].title).toContain("已变成行动证据");
    expect(state.proofs.records[0].status).toBe("rewarded");
  });
});
```

- [ ] **Step 2: Run deck action tests**

Run:

```bash
pnpm test tests/store/deck-actions.test.ts
```

Expected: all tests pass with current store behavior.

- [ ] **Step 3: Commit**

```bash
git add tests/store/deck-actions.test.ts
git commit -m "test: cover deck action state machine"
```

---

### Task 6: Test localStorage Persistence Shape

**Files:**
- Create: `tests/store/persistence.test.ts`
- Read: `store/useNextCardStore.ts`

- [ ] **Step 1: Write failing persistence tests**

Create `tests/store/persistence.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import { generateCourseDeckInStore, resetNextCardStore } from "../helpers/nextCardStore";

describe("zustand persistence", () => {
  beforeEach(() => {
    resetNextCardStore();
  });

  it("persists decks, task flow, and proof records under next-card-mvp", () => {
    generateCourseDeckInStore();

    const persistedRaw = localStorage.getItem("next-card-mvp");
    expect(persistedRaw).toBeTruthy();

    const persisted = JSON.parse(persistedRaw ?? "{}");

    expect(persisted.state.inputs.text).toBe("去高数课");
    expect(persisted.state.taskFlow.nodes).toHaveLength(4);
    expect(persisted.state.deck.decks).toHaveLength(1);
    expect(persisted.state.proofs.records).toHaveLength(1);
    expect(persisted.state.mode).toBeUndefined();
  });

  it("persists frozen and completed card ids after deck actions", () => {
    generateCourseDeckInStore();
    const firstCardId = useNextCardStore.getState().deck.currentCardId;

    useNextCardStore.getState().freezeCurrentCard();
    useNextCardStore.getState().completeCurrentCard("left");

    const persisted = JSON.parse(localStorage.getItem("next-card-mvp") ?? "{}");

    expect(persisted.state.deck.frozenCardIds).toContain(firstCardId);
    expect(persisted.state.deck.rescheduleQueue).toContain(firstCardId);
    expect(persisted.state.deck.completedCardIds.length).toBeGreaterThanOrEqual(1);
    expect(persisted.state.proofs.summaryDocument).toContain("行动证据");
  });
});
```

- [ ] **Step 2: Run persistence tests**

Run:

```bash
pnpm test tests/store/persistence.test.ts
```

Expected: all tests pass. If localStorage writes are asynchronous in this environment, add `await new Promise((resolve) => setTimeout(resolve, 0));` after store actions in the tests.

- [ ] **Step 3: Commit**

```bash
git add tests/store/persistence.test.ts
git commit -m "test: cover persisted next card state"
```

---

### Task 7: Add A Testable Card Time Engine

**Files:**
- Create: `lib/card-time-engine.ts`
- Create: `tests/lib/card-time-engine.test.ts`
- Modify: `store/useNextCardStore.ts`

- [ ] **Step 1: Write failing unit tests for time refresh**

Create `tests/lib/card-time-engine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { refreshCardTimeState, refreshDeckTimeState } from "@/lib/card-time-engine";
import type { TaskCard, TaskDeck } from "@/lib/types";

const baseCard: TaskCard = {
  id: "card-1",
  deckId: "deck-1",
  flowNodeId: "flow-1",
  title: "确认高数课时间和教室",
  action: "打开来源信息，圈出时间、地点和必须完成的一个动作。",
  estimatedMinutes: 4,
  deadlineAt: "2026-05-16T08:10:00.000Z",
  suggestedStartAt: "2026-05-16T08:00:00.000Z",
  startedAt: null,
  elapsedSeconds: 0,
  remainingSeconds: null,
  urgencyStage: "calm",
  damageEffect: "none",
  damageProgress: 0,
  burnLevel: 0,
  status: "active",
  encouragement: "先做这一小步。",
  cardBackNote: "保留上下文。"
};

describe("card time engine", () => {
  it("refreshes deadline cards into hot, burning, and expired stages", () => {
    expect(refreshCardTimeState(baseCard, new Date("2026-05-16T07:55:00.000Z")).urgencyStage).toBe("hot");
    expect(refreshCardTimeState(baseCard, new Date("2026-05-16T08:08:00.000Z")).urgencyStage).toBe("burning");
    expect(refreshCardTimeState(baseCard, new Date("2026-05-16T08:11:00.000Z")).urgencyStage).toBe("expired");
  });

  it("does not mutate completed, frozen, rewarded, or needs-review cards", () => {
    const frozen = { ...baseCard, status: "frozen" as const, damageEffect: "freeze" as const };

    expect(refreshCardTimeState(frozen, new Date("2026-05-16T08:11:00.000Z"))).toEqual(frozen);
  });

  it("refreshes all actionable cards in a deck", () => {
    const deck: TaskDeck = {
      id: "deck-1",
      coverTitle: "去高数课",
      coverIcon: "course",
      deckStatus: "active",
      cards: [
        baseCard,
        { ...baseCard, id: "card-2", status: "queued", deadlineAt: "2026-05-16T08:40:00.000Z" },
        { ...baseCard, id: "card-3", status: "completed", deadlineAt: "2026-05-16T08:00:00.000Z" }
      ],
      totalCards: 3,
      completedCards: 1
    };

    const refreshed = refreshDeckTimeState(deck, new Date("2026-05-16T08:08:00.000Z"));

    expect(refreshed.cards[0].urgencyStage).toBe("burning");
    expect(refreshed.cards[1].urgencyStage).toBe("calm");
    expect(refreshed.cards[2].status).toBe("completed");
  });
});
```

- [ ] **Step 2: Implement the time engine**

Create `lib/card-time-engine.ts`:

```ts
import { mockUpdateCardUrgency } from "@/lib/mock-ai";
import type { TaskCard, TaskDeck } from "@/lib/types";

const lockedStatuses = new Set<TaskCard["status"]>(["completed", "frozen", "rewarded", "needs-review"]);

export function refreshCardTimeState(card: TaskCard, now = new Date()): TaskCard {
  if (lockedStatuses.has(card.status)) {
    return card;
  }

  return mockUpdateCardUrgency(card, now);
}

export function refreshDeckTimeState(deck: TaskDeck, now = new Date()): TaskDeck {
  return {
    ...deck,
    cards: deck.cards.map((card) => refreshCardTimeState(card, now))
  };
}
```

- [ ] **Step 3: Add store action type**

Modify the `NextCardStore` type in `store/useNextCardStore.ts`:

```ts
refreshActiveDeckTime: (nowIso?: string) => void;
```

- [ ] **Step 4: Import the time engine in the store**

Add this import to `store/useNextCardStore.ts`:

```ts
import { refreshDeckTimeState } from "@/lib/card-time-engine";
```

- [ ] **Step 5: Implement store action**

Add this action inside the store object in `store/useNextCardStore.ts`:

```ts
refreshActiveDeckTime: (nowIso) =>
  set((state) => {
    const activeDeck = state.deck.decks.find((deck) => deck.id === state.deck.activeDeckId);

    if (!activeDeck) {
      return state;
    }

    const refreshedDeck = refreshDeckTimeState(activeDeck, nowIso ? new Date(nowIso) : new Date());

    return {
      deck: {
        ...state.deck,
        decks: replaceDeck(state.deck.decks, refreshedDeck)
      }
    };
  }),
```

- [ ] **Step 6: Run time engine tests**

Run:

```bash
pnpm test tests/lib/card-time-engine.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/card-time-engine.ts tests/lib/card-time-engine.test.ts store/useNextCardStore.ts
git commit -m "feat: add card time refresh engine"
```

---

### Task 8: Add Store Tests For Time Refresh And Frozen Resume

**Files:**
- Create: `tests/store/time-and-reschedule.test.ts`
- Modify: `store/useNextCardStore.ts`

- [ ] **Step 1: Write failing tests for store time refresh and resume**

Create `tests/store/time-and-reschedule.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import { generateCourseDeckInStore, resetNextCardStore } from "../helpers/nextCardStore";

describe("time refresh and reschedule queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T08:00:00.000Z"));
    resetNextCardStore();
    generateCourseDeckInStore();
  });

  it("refreshes active deck time state without writing noisy proof records", () => {
    const proofCountBefore = useNextCardStore.getState().proofs.records.length;

    useNextCardStore.getState().refreshActiveDeckTime("2026-05-16T08:11:00.000Z");

    const state = useNextCardStore.getState();
    const currentCard = state.deck.decks[0].cards.find((card) => card.id === state.deck.currentCardId);

    expect(currentCard?.urgencyStage).toBe("expired");
    expect(currentCard?.damageEffect).toBe("crack");
    expect(currentCard?.remainingSeconds).toBe(0);
    expect(state.proofs.records).toHaveLength(proofCountBefore);
  });

  it("resumes a frozen card from reschedule queue", () => {
    const frozenCardId = useNextCardStore.getState().deck.currentCardId;
    useNextCardStore.getState().freezeCurrentCard();

    expect(useNextCardStore.getState().deck.rescheduleQueue).toContain(frozenCardId);

    useNextCardStore.getState().resumeFrozenCard(frozenCardId ?? "");

    const state = useNextCardStore.getState();
    const deck = state.deck.decks[0];
    const resumedCard = deck.cards.find((card) => card.id === frozenCardId);

    expect(state.deck.activeDeckId).toBe(deck.id);
    expect(state.deck.currentCardId).toBe(frozenCardId);
    expect(state.deck.rescheduleQueue).not.toContain(frozenCardId);
    expect(state.deck.frozenCardIds).not.toContain(frozenCardId);
    expect(resumedCard?.status).toBe("active");
    expect(resumedCard?.damageEffect).toBe("none");
    expect(resumedCard?.urgencyStage).toBe("warm");
    expect(state.proofs.records[0]).toMatchObject({
      status: "in-progress",
      timeStatus: "frozen-rescheduled",
      lastAction: `恢复冻结卡：${resumedCard?.title}`
    });
  });

  it("ignores unknown frozen card ids", () => {
    const before = useNextCardStore.getState();

    useNextCardStore.getState().resumeFrozenCard("missing-card");

    const after = useNextCardStore.getState();

    expect(after.deck).toEqual(before.deck);
    expect(after.proofs).toEqual(before.proofs);
  });
});
```

- [ ] **Step 2: Add store action type**

Modify the `NextCardStore` type in `store/useNextCardStore.ts`:

```ts
resumeFrozenCard: (cardId: string) => void;
```

- [ ] **Step 3: Implement `resumeFrozenCard`**

Add this action inside the store object in `store/useNextCardStore.ts`:

```ts
resumeFrozenCard: (cardId) =>
  set((state) => {
    const ownerDeck = state.deck.decks.find((deck) => deck.cards.some((card) => card.id === cardId));
    const frozenCard = ownerDeck?.cards.find((card) => card.id === cardId);

    if (!ownerDeck || !frozenCard || frozenCard.status !== "frozen") {
      return state;
    }

    const cards = ownerDeck.cards.map((card) => {
      if (card.id === cardId) {
        return {
          ...card,
          status: "active" as const,
          urgencyStage: "warm" as const,
          damageEffect: "none" as const,
          damageProgress: 0,
          burnLevel: 0 as const,
          startedAt: null,
          suggestedStartAt: new Date().toISOString(),
          cardBackNote: "已从冻结队列恢复，继续做这一小步就好。"
        };
      }

      if (card.status === "active") {
        return { ...card, status: "queued" as const };
      }

      return card;
    });
    const updatedDeck: TaskDeck = {
      ...ownerDeck,
      deckStatus: "active",
      cards
    };
    const frozenCardIds = state.deck.frozenCardIds.filter((id) => id !== cardId);
    const rescheduleQueue = state.deck.rescheduleQueue.filter((id) => id !== cardId);
    const proofRecord: ProofRecord = {
      id: makeProofId(),
      goalTitle: ownerDeck.coverTitle,
      source: state.inputs.sourceType,
      status: "in-progress",
      ...getDeckProofProgress(updatedDeck, frozenCardIds.length),
      actualMinutes: 0,
      timeStatus: "frozen-rescheduled",
      timeDamageEvents: ["从 reschedule queue 恢复冻结卡"],
      lastAction: `恢复冻结卡：${frozenCard.title}`,
      nextSuggestion: "继续完成这张卡，或再次冻结保留上下文",
      createdAt: new Date().toISOString()
    };
    const records = [proofRecord, ...state.proofs.records];

    return {
      taskFlow: updateFlowFromCards(state.taskFlow, cards),
      deck: {
        ...state.deck,
        decks: replaceDeck(state.deck.decks, updatedDeck),
        activeDeckId: ownerDeck.id,
        currentCardId: cardId,
        frozenCardIds,
        rescheduleQueue,
        activeTimeMode: "idle"
      },
      proofs: {
        records,
        summaryDocument: mockGenerateProofSummary(records)
      }
    };
  }),
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test tests/store/time-and-reschedule.test.ts
```

Expected: tests pass after Task 7 and the `resumeFrozenCard` action are implemented.

- [ ] **Step 5: Commit**

```bash
git add store/useNextCardStore.ts tests/store/time-and-reschedule.test.ts
git commit -m "feat: resume frozen cards from reschedule queue"
```

---

### Task 9: Normalize Proof Record Semantics With Tests

**Files:**
- Create: `tests/store/proof-semantics.test.ts`
- Modify: `store/useNextCardStore.ts`
- Optional Create: `lib/proof-records.ts`

- [ ] **Step 1: Write tests that define current proof semantics**

Create `tests/store/proof-semantics.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import { generateCourseDeckInStore, resetNextCardStore } from "../helpers/nextCardStore";

describe("proof semantics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T08:00:00.000Z"));
    resetNextCardStore();
    generateCourseDeckInStore();
  });

  it("records plan selection as in-progress, not as completed work", () => {
    const record = useNextCardStore.getState().proofs.records[0];

    expect(record.status).toBe("in-progress");
    expect(record.progress).toBe(0);
    expect(record.actualMinutes).toBe(0);
    expect(record.lastAction).toContain("生成任务流");
  });

  it("records timing and burning as events without increasing completed card count", () => {
    useNextCardStore.getState().startFocusTiming();
    useNextCardStore.getState().startQuickBurning();

    const [burnRecord, timingRecord] = useNextCardStore.getState().proofs.records;

    expect(timingRecord.completedCards).toBe(0);
    expect(burnRecord.completedCards).toBe(0);
    expect(burnRecord.lastDamageEffect).toBe("burn");
  });

  it("records card completion with progress and actual time", () => {
    useNextCardStore.getState().completeCurrentCard("right");

    const record = useNextCardStore.getState().proofs.records[0];

    expect(record.status).toBe("completed");
    expect(record.completedCards).toBe(1);
    expect(record.progress).toBeGreaterThan(0);
    expect(record.actualMinutes).toBeGreaterThan(0);
  });

  it("records reward only when all deck cards are complete", () => {
    while (useNextCardStore.getState().deck.currentCardId) {
      useNextCardStore.getState().completeCurrentCard("button");
    }

    const records = useNextCardStore.getState().proofs.records;

    expect(records[0].status).toBe("rewarded");
    expect(records[0].progress).toBe(100);
    expect(records[0].lastAction).toContain("已变成行动证据");
  });
});
```

- [ ] **Step 2: Run proof semantics tests**

Run:

```bash
pnpm test tests/store/proof-semantics.test.ts
```

Expected: tests should expose whether the current initial burning demo writes `timeStatus: "burning-completed"` too early. If it does, change the initial plan-selection proof record in `selectPlan` to use `timeStatus: "on-time"` and keep the burn event in `timeDamageEvents`.

- [ ] **Step 3: Make the minimal store change if the initial proof event is too strong**

In `store/useNextCardStore.ts`, inside `selectPlan`, change this field:

```ts
timeStatus: "on-time",
```

Keep this field:

```ts
timeDamageEvents:
  generatedDeck.cards[0]?.damageEffect === "burn"
    ? ["生成第一张近截止燃烧演示卡"]
    : ["生成执行卡组"],
```

- [ ] **Step 4: Run affected tests**

Run:

```bash
pnpm test tests/store/proof-semantics.test.ts tests/store/planning-flow.test.ts tests/store/deck-actions.test.ts
```

Expected: tests pass and proof wording stays consistent.

- [ ] **Step 5: Commit**

```bash
git add tests/store/proof-semantics.test.ts store/useNextCardStore.ts
git commit -m "test: lock proof event semantics"
```

---

### Task 10: Add Playwright MVP Smoke Tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/mvp-flow.spec.ts`
- Read: `components/input/InputComposer.tsx`
- Read: `components/input/PlanModePanel.tsx`
- Read: `components/deck/DeckLibrary.tsx`
- Read: `components/proof/ProofDashboard.tsx`

- [ ] **Step 1: Create Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 8_000
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"]
      }
    }
  ]
});
```

- [ ] **Step 2: Write one stable smoke test**

Create `tests/e2e/mvp-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("course goal can generate plan, deck, and proof", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "input" }).click();

  const composer = page.getByPlaceholder(/写下一句话|课程表|作业通知/);
  await composer.fill("去高数课");
  await page.getByRole("button", { name: /生成执行方案/ }).click();

  await expect(page.getByText("方案一")).toBeVisible();
  await expect(page.getByRole("button", { name: "执行方案一" })).toBeVisible();

  await page.getByRole("button", { name: "执行方案一" }).click();
  await expect(page.getByText(/任务流/)).toBeVisible();

  await page.getByRole("tab", { name: "deck" }).click();
  await expect(page.getByText("去高数课")).toBeVisible();
  await page.getByText("去高数课").first().click();
  await expect(page.getByText(/确认高数课时间和教室/)).toBeVisible();
  await expect(page.getByText(/burning|hot|calm|warm|expired/)).toBeVisible();

  await page.getByRole("button", { name: /完成|右滑完成|标记完成/ }).click();

  await page.getByRole("tab", { name: "proof" }).click();
  await expect(page.getByText(/行动证据|proof table|flow journal/)).toBeVisible();
});
```

- [ ] **Step 3: Stabilize selectors only if the current UI names differ**

If the test cannot find the composer or completion button, add accessible names in the component files instead of using fragile CSS selectors. Keep changes minimal:

```tsx
aria-label="目标输入"
```

or:

```tsx
aria-label="完成当前卡片"
```

- [ ] **Step 4: Run smoke test**

Run:

```bash
pnpm test:e2e
```

Expected: one mobile Chromium smoke test passes.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/mvp-flow.spec.ts components/input components/deck
git commit -m "test: add mvp browser smoke flow"
```

---

### Task 11: Add CI For Backend Confidence

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Create GitHub Actions workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test

      - name: Build
        run: pnpm build
```

- [ ] **Step 2: Update README test commands**

In `README.md`, update the handoff commands section:

```bash
pnpm lint
pnpm test
pnpm build
```

Add one sentence under Current Stack:

```text
Vitest covers the local backend state machine and mock AI contract; Playwright is reserved for small mobile WebView smoke flows.
```

- [ ] **Step 3: Run full local verification**

Run:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: all commands pass.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: verify lint tests and build"
```

---

### Task 12: Document Real Backend Extension Boundaries

**Files:**
- Modify: `lib/page-contracts.ts`
- Modify: `README.md`
- Optional Create: `docs/backend-extension-boundaries.md`

- [ ] **Step 1: Create backend extension boundary doc**

Create `docs/backend-extension-boundaries.md`:

```md
# Backend Extension Boundaries

Next Card MVP intentionally uses mock AI, mock OCR, and local state. Real services should connect only after the local deck loop is stable and tested.

## Planning API

Current owner:
- `lib/mock-ai.ts`

Future boundary:
- `mockAnalyzeInput`
- `mockGeneratePlanOptions`
- `mockRegeneratePlanOptions`
- `mockGenerateTaskFlow`
- `mockGenerateDeckFromPlan`

The first real planning service should return the same domain shapes from `lib/types.ts`.

## OCR API

Current owner:
- `InputsState.imageSchedule`
- `InputsState.parsedText`

Future boundary:
- Accept uploaded image bytes in native wrapper or web upload.
- Return `UploadedImage.parsedTimetable`.
- Append parsed content into `inputs.parsedText`.

## Persistence API

Current owner:
- Zustand localStorage key `next-card-mvp`

Future boundary:
- Sync `inputs`, `taskFlow`, `deck`, and `proofs`.
- Do not persist UI-only mode as canonical backend state.

## Reminder And Calendar API

Current owner:
- `deadlineAt`
- `suggestedStartAt`
- `rescheduleQueue`

Future boundary:
- Native Android bridge can schedule reminders from cards.
- Calendar sync should not create a fourth primary app mode.

## Proof Export API

Current owner:
- `proofs.summaryDocument`
- `proofs.records`

Future boundary:
- Export Markdown, PDF, or backend proof archive after proof semantics are stable.
```

- [ ] **Step 2: Link the doc from README**

Add under "Mock AI Contract" or "Suggested Next PR":

```md
Backend extension boundaries are documented in:

```text
docs/backend-extension-boundaries.md
```
```

- [ ] **Step 3: Add explicit backlog entry**

In `lib/page-contracts.ts`, append to `NEXT_IMPLEMENTATION_BACKLOG`:

```ts
"Use docs/backend-extension-boundaries.md before wiring real OCR, OpenAI, backend persistence, reminders, or calendar sync."
```

- [ ] **Step 4: Run verification**

Run:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add docs/backend-extension-boundaries.md README.md lib/page-contracts.ts
git commit -m "docs: define backend extension boundaries"
```

---

## Priority Order

1. Task 1: Test runner foundation.
2. Task 2: Mock AI tests.
3. Task 3: Store test helpers.
4. Task 4: Planning store flow tests.
5. Task 5: Deck action tests.
6. Task 6: Persistence tests.
7. Task 7: Card time engine.
8. Task 8: Frozen-card resume.
9. Task 9: Proof semantics.
10. Task 11: CI.
11. Task 10: Playwright smoke test, after UI selectors stabilize.
12. Task 12: Backend extension boundary doc.

## Not In Current Backend Scope

- Real OCR.
- Real OpenAI API.
- Real backend database.
- Authentication.
- Calendar sync.
- Push notifications.
- Native Android WebView bridge implementation.

These should stay mocked until Tasks 1 through 9 are passing.

## Final Verification

Run:

```bash
pnpm lint
pnpm test
pnpm build
```

If Playwright smoke tests are enabled for the branch, also run:

```bash
pnpm test:e2e
```

## Self-Review

- Spec coverage: The plan covers mock AI, deck store actions, freeze/reschedule queue, time urgency, proof records, localStorage persistence, CI, and future backend boundaries from `AGENTS.md`.
- Placeholder scan: No task uses undefined acceptance. Each code-changing task names exact files, commands, and expected output.
- Type consistency: The plan reuses existing `TaskCard`, `TaskDeck`, `ProofRecord`, `PlanOption`, and Zustand action names from `lib/types.ts` and `store/useNextCardStore.ts`.

Plan complete and saved to `docs/superpowers/plans/2026-05-16-backend-testing.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh worker per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.

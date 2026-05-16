import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";

const baseNow = new Date("2026-05-16T08:00:00.000Z");

type StoreState = ReturnType<typeof useNextCardStore.getState>;

function freshState(): Partial<StoreState> {
  return {
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
      summaryDocument: "还没有形成证明记录。生成一个执行方案后，这里会开始记录目标、时间状态、冻结和奖励事件。"
    }
  };
}

function state() {
  return useNextCardStore.getState();
}

function resetStore() {
  localStorage.clear();
  useNextCardStore.setState(freshState());
}

function createReadyPlans(text = "去高数课") {
  state().setInputText(text);
  state().analyzeInput();
  state().finishAnalysis();
}

function selectCourseDeck() {
  createReadyPlans("去高数课");
  state().selectPlan("plan-1");
  const activeDeck = state().deck.decks.find((deck) => deck.id === state().deck.activeDeckId);

  if (!activeDeck) {
    throw new Error("Expected active deck");
  }

  return activeDeck;
}

describe("useNextCardStore input and plan flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetStore();
  });

  it("starts in input mode with empty local deck state and an empty proof summary", () => {
    expect(state().mode).toBe("input");
    expect(state().inputs.sourceType).toBe("text");
    expect(state().deck.decks).toEqual([]);
    expect(state().proofs.summaryDocument).toContain("还没有形成证明记录");
  });

  it("stores typed text as text source when there are no mock files", () => {
    state().setInputText("去高数课");

    expect(state().inputs).toMatchObject({
      text: "去高数课",
      sourceType: "text"
    });
  });

  it("marks typed text as mixed source when a mock attachment already exists", () => {
    state().addMockAttachment();
    state().setInputText("帮我处理这份通知");

    expect(state().inputs.sourceType).toBe("mixed");
    expect(state().inputs.parsedText).toContain("今晚 20:00 前提交");
  });

  it("adds a mock attachment with parsed assignment text", () => {
    state().addMockAttachment();

    expect(state().inputs.attachments).toHaveLength(1);
    expect(state().inputs.attachments[0]).toMatchObject({
      name: "assignment-notice.txt",
      kind: "notice"
    });
    expect(state().inputs.sourceType).toBe("attachment");
    expect(state().inputs.parsedText).toContain("课程作业通知");
  });

  it("adds a mock image timetable with parsed course text", () => {
    state().addMockImageSchedule();

    expect(state().inputs.imageSchedule?.name).toBe("mock-timetable.png");
    expect(state().inputs.parsedText).toContain("明天 08:00 高数课");
    expect(state().inputs.sourceType).toBe("image");
  });

  it("sets analyzing state and stores understanding before plan options are shown", () => {
    state().setInputText("去高数课");
    state().analyzeInput();

    expect(state().analysisStatus).toBe("analyzing");
    expect(state().analysis?.goalUnderstanding).toContain("出门/到课卡组");
    expect(state().plans.options).toEqual([]);
    expect(state().taskFlow).toBeNull();
  });

  it("finishes analysis with exactly three executable plan options", () => {
    createReadyPlans("今晚 20:00 前交作业");

    expect(state().analysisStatus).toBe("ready");
    expect(state().plans.options).toHaveLength(3);
    expect(state().plans.options.map((option) => option.id)).toEqual(["plan-1", "plan-2", "plan-3"]);
    expect(state().plans.selectedPlanId).toBeNull();
  });

  it("regenerates plans while keeping the original input and incrementing the count", () => {
    createReadyPlans("去高数课");
    state().regeneratePlans();

    expect(state().inputs.text).toBe("去高数课");
    expect(state().plans.regenerateCount).toBe(1);
    expect(state().plans.options[0].summary).toContain("重新生成");
    expect(state().taskFlow).toBeNull();
  });
});

describe("useNextCardStore deck generation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetStore();
  });

  it("selecting a plan creates a task flow, active course deck, and initial proof record", () => {
    createReadyPlans("去高数课");
    state().selectPlan("plan-1");

    const activeDeck = state().deck.decks[0];
    expect(state().plans.selectedPlanId).toBe("plan-1");
    expect(state().taskFlow?.nodes).toHaveLength(4);
    expect(activeDeck).toMatchObject({
      coverTitle: "去高数课",
      coverIcon: "course",
      completedCards: 0
    });
    expect(activeDeck.cards[0]).toMatchObject({
      status: "active",
      urgencyStage: "burning",
      damageEffect: "burn"
    });
    expect(state().deck.activeDeckId).toBe(activeDeck.id);
    expect(state().deck.currentCardId).toBe(activeDeck.cards[0].id);
    expect(state().proofs.records[0]).toMatchObject({
      goalTitle: "去高数课",
      status: "in-progress",
      progress: 0,
      timeStatus: "on-time",
      lastDamageEffect: "burn"
    });
  });

  it("re-selecting a plan for the same goal replaces the deck cover instead of duplicating it", () => {
    createReadyPlans("去高数课");
    state().selectPlan("plan-1");
    const firstDeckId = state().deck.activeDeckId;

    state().selectPlan("plan-2");

    expect(state().deck.decks).toHaveLength(1);
    expect(state().deck.decks[0].coverTitle).toBe("去高数课");
    expect(state().deck.activeDeckId).not.toBe(firstDeckId);
    expect(state().plans.selectedPlanId).toBe("plan-2");
  });

  it("ignores selection requests for missing plan ids", () => {
    createReadyPlans("去高数课");
    state().selectPlan("missing-plan" as "plan-1");

    expect(state().deck.decks).toEqual([]);
    expect(state().taskFlow).toBeNull();
  });

  it("opens an existing deck into deck mode and chooses the active card", () => {
    const deck = selectCourseDeck();
    state().setMode("proof");

    state().openDeck(deck.id);

    expect(state().mode).toBe("deck");
    expect(state().deck.activeDeckId).toBe(deck.id);
    expect(state().deck.currentCardId).toBe(deck.cards[0].id);
  });
});

describe("useNextCardStore card timing and damage events", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetStore();
  });

  it("double-click timing state starts focus timing and writes proof", () => {
    const deck = selectCourseDeck();

    state().startFocusTiming();

    const updatedDeck = state().deck.decks.find((item) => item.id === deck.id);
    const activeCard = updatedDeck?.cards.find((card) => card.id === state().deck.currentCardId);
    expect(state().deck.activeTimeMode).toBe("timing");
    expect(updatedDeck?.deckStatus).toBe("active");
    expect(activeCard?.startedAt).toBe(baseNow.toISOString());
    expect(state().proofs.records[0].timeDamageEvents).toContain("双击卡片，开始专注计时");
  });

  it("triple-click quick burning mode heats the active card and writes proof", () => {
    const deck = selectCourseDeck();

    state().startQuickBurning();

    const updatedDeck = state().deck.decks.find((item) => item.id === deck.id);
    const activeCard = updatedDeck?.cards.find((card) => card.id === state().deck.currentCardId);
    expect(state().deck.activeTimeMode).toBe("burning");
    expect(activeCard).toMatchObject({
      urgencyStage: "burning",
      damageEffect: "burn",
      damageProgress: 84,
      burnLevel: 3,
      status: "active"
    });
    expect(state().proofs.records[0]).toMatchObject({
      lastDamageEffect: "burn",
      lastAction: expect.stringContaining("快速燃烧启动")
    });
  });

  it("does not mutate state when timing starts without an active card", () => {
    state().startFocusTiming();
    state().startQuickBurning();

    expect(state().deck.activeTimeMode).toBe("idle");
    expect(state().proofs.records).toEqual([]);
  });

  it("continues from paused mode by returning to idle pressure", () => {
    selectCourseDeck();
    state().freezeCurrentCard();

    expect(state().deck.activeTimeMode).toBe("paused");
    state().continueCurrentCard();

    expect(state().deck.activeTimeMode).toBe("idle");
  });
});

describe("useNextCardStore completion, freezing, and rewards", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetStore();
  });

  it("completes the current card, advances to the next card, and updates proof", () => {
    const deck = selectCourseDeck();
    const firstCardId = deck.cards[0].id;

    state().completeCurrentCard("right");

    const updatedDeck = state().deck.decks.find((item) => item.id === deck.id);
    expect(updatedDeck?.completedCards).toBe(1);
    expect(updatedDeck?.cards.find((card) => card.id === firstCardId)?.status).toBe("completed");
    expect(updatedDeck?.cards[1].status).toBe("active");
    expect(state().deck.currentCardId).toBe(updatedDeck?.cards[1].id);
    expect(state().deck.completedCardIds).toContain(firstCardId);
    expect(state().taskFlow?.overallProgress).toBe(20);
    expect(state().proofs.records[0]).toMatchObject({
      status: "completed",
      progress: 20,
      completedCards: 1,
      timeStatus: "burning-completed",
      lastAction: expect.stringContaining("完成")
    });
  });

  it("records left swipe and button completion directions in proof", () => {
    selectCourseDeck();

    state().completeCurrentCard("left");
    state().completeCurrentCard("button");

    expect(state().proofs.records[1].timeDamageEvents[0]).toContain("左滑完成卡片");
    expect(state().proofs.records[0].timeDamageEvents[0]).toContain("按钮完成卡片");
  });

  it("freezes the current card, queues it for rescheduling, and advances to the next card", () => {
    const deck = selectCourseDeck();
    const firstCardId = deck.cards[0].id;

    state().freezeCurrentCard();

    const updatedDeck = state().deck.decks.find((item) => item.id === deck.id);
    expect(updatedDeck?.cards.find((card) => card.id === firstCardId)).toMatchObject({
      status: "frozen",
      damageEffect: "freeze",
      urgencyStage: "calm"
    });
    expect(updatedDeck?.cards[1].status).toBe("active");
    expect(state().deck.currentCardId).toBe(updatedDeck?.cards[1].id);
    expect(state().deck.frozenCardIds).toEqual([firstCardId]);
    expect(state().deck.rescheduleQueue).toEqual([firstCardId]);
    expect(state().taskFlow?.nodes[0].status).toBe("frozen");
    expect(state().proofs.records[0]).toMatchObject({
      status: "frozen",
      timeStatus: "frozen-rescheduled",
      lastDamageEffect: "freeze"
    });
  });

  it("does not mutate completion or freeze state without an active deck", () => {
    state().completeCurrentCard("right");
    state().freezeCurrentCard();

    expect(state().deck.completedCardIds).toEqual([]);
    expect(state().deck.frozenCardIds).toEqual([]);
    expect(state().proofs.records).toEqual([]);
  });

  it("creates a reward card and rewarded proof when the deck is completed", () => {
    const deck = selectCourseDeck();

    while (state().deck.currentCardId) {
      state().completeCurrentCard("button");
    }

    const completedDeck = state().deck.decks.find((item) => item.id === deck.id);
    expect(completedDeck?.deckStatus).toBe("completed");
    expect(completedDeck?.completedCards).toBe(completedDeck?.totalCards);
    expect(state().deck.rewardCards).toHaveLength(1);
    expect(state().deck.rewardCards[0]).toMatchObject({
      deckId: deck.id,
      title: "去高数课 已变成行动证据"
    });
    expect(state().proofs.records[0]).toMatchObject({
      status: "rewarded",
      progress: 100,
      completedCards: deck.totalCards
    });
    expect(state().proofs.summaryDocument).toContain("行动证据");
  });

  it("persists generated deck and proof state to localStorage", () => {
    selectCourseDeck();

    const persisted = localStorage.getItem("next-card-mvp");

    expect(persisted).toContain("去高数课");
    expect(persisted).toContain("proofs");
    expect(persisted).toContain("deck");
  });
});

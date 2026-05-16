import { useNextCardStore } from "@/store/useNextCardStore";
import type { TaskCard, TaskDeck } from "@/lib/types";

export type NextCardStoreState = ReturnType<typeof useNextCardStore.getState>;

export type ExtendedNextCardStoreState = NextCardStoreState & {
  refreshActiveDeckTime: (nowIso?: string) => void;
  resumeFrozenCard: (cardId: string) => void;
};

export const initialSummary =
  "还没有形成证明记录。生成一个执行方案后，这里会开始记录目标、时间状态、冻结和奖励事件。";

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
      summaryDocument: initialSummary
    }
  });
}

export function storeState() {
  return useNextCardStore.getState() as ExtendedNextCardStoreState;
}

export function generateCourseDeckInStore(): TaskDeck {
  const store = storeState();

  store.setInputText("去高数课");
  store.analyzeInput();
  store.finishAnalysis();
  store.selectPlan("plan-1");

  const activeDeck = getActiveDeck();
  if (activeDeck.coverTitle !== "去高数课") {
    throw new Error(`Expected 去高数课 deck, received ${activeDeck.coverTitle}`);
  }

  return activeDeck;
}

export function getActiveDeck(): TaskDeck {
  const state = storeState();
  const deck = state.deck.decks.find((item) => item.id === state.deck.activeDeckId);

  if (!deck) {
    throw new Error("Expected an active deck");
  }

  return deck;
}

export function getActiveCard(): TaskCard {
  const state = storeState();
  const deck = getActiveDeck();
  const card = deck.cards.find((item) => item.id === state.deck.currentCardId);

  if (!card) {
    throw new Error("Expected an active card");
  }

  return card;
}

export function getPersistedState() {
  const raw = localStorage.getItem("next-card-mvp");

  if (!raw) {
    throw new Error("Expected next-card-mvp localStorage entry");
  }

  return JSON.parse(raw) as { state: Partial<NextCardStoreState>; version: number };
}

export function completeActiveDeck() {
  while (storeState().deck.currentCardId) {
    storeState().completeCurrentCard("button");
  }
}

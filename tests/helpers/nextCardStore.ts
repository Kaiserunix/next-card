import { useNextCardStore } from "@/store/useNextCardStore";
import { mockGenerateProofSummary } from "@/lib/mock-ai";
import type { TaskCard, TaskDeck } from "@/lib/types";

const STORAGE_KEY = "next-card-mvp";

export function resetNextCardStore() {
  if (typeof window !== "undefined") {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }

  useNextCardStore.setState({
    mode: "input",
    inputs: {
      text: "",
      attachments: [],
      imageSchedule: null,
      parsedText: "",
      sourceType: "text",
    },
    analysis: null,
    analysisStatus: "idle",
    plans: {
      goalUnderstanding: "",
      constraints: [],
      timeStrategy: [],
      options: [],
      selectedPlanId: null,
      regenerateCount: 0,
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
      activeTimeMode: "idle",
    },
    proofs: {
      records: [],
      summaryDocument: mockGenerateProofSummary([]),
    },
  });

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function generateCourseDeckInStore(): TaskDeck {
  const store = useNextCardStore.getState();

  store.setInputText("去高数课");
  store.analyzeInput();
  useNextCardStore.getState().finishAnalysis();
  useNextCardStore.getState().selectPlan("plan-1");

  const after = useNextCardStore.getState();
  const deck = after.deck.decks.find((item) => item.id === after.deck.activeDeckId);

  if (!deck) {
    throw new Error("generateCourseDeckInStore: no active deck after selectPlan");
  }

  return deck;
}

export function getActiveCard(): { deck: TaskDeck; card: TaskCard } {
  const state = useNextCardStore.getState();
  const deck = state.deck.decks.find((item) => item.id === state.deck.activeDeckId);

  if (!deck) {
    throw new Error("getActiveCard: no active deck");
  }

  const card = deck.cards.find((item) => item.id === state.deck.currentCardId);

  if (!card) {
    throw new Error("getActiveCard: no current card in active deck");
  }

  return { deck, card };
}

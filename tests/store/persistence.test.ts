import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeActiveDeck,
  generateCourseDeckInStore,
  getActiveDeck,
  getPersistedState,
  resetNextCardStore,
  storeState
} from "@/tests/helpers/nextCardStore";

const baseNow = new Date("2026-05-16T08:00:00.000Z");

describe("next-card-mvp persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetNextCardStore();
  });

  it("persists input, analysis, plans, task flow, deck, and proof after deck generation", () => {
    const deck = generateCourseDeckInStore();
    const persisted = getPersistedState().state;

    expect(persisted.inputs?.text).toBe("去高数课");
    expect(persisted.analysis?.goalUnderstanding).toContain("出门/到课卡组");
    expect(persisted.plans?.options).toHaveLength(3);
    expect(persisted.taskFlow?.nodes).toHaveLength(4);
    expect(persisted.deck?.decks[0].id).toBe(deck.id);
    expect(persisted.deck?.activeDeckId).toBe(deck.id);
    expect(persisted.deck?.currentCardId).toBe(deck.cards[0].id);
    expect(persisted.proofs?.records).toHaveLength(1);
    expect(persisted.proofs?.summaryDocument).toContain("行动证据");
  });

  it("uses the next-card-mvp storage key and only persists restore-critical business slices", () => {
    generateCourseDeckInStore();

    expect(localStorage.getItem("next-card-mvp")).not.toBeNull();
    const persisted = getPersistedState();

    expect(persisted.version).toBe(0);
    expect(Object.keys(persisted.state).sort()).toEqual([
      "analysis",
      "analysisStatus",
      "deck",
      "inputs",
      "plans",
      "proofs",
      "taskFlow"
    ]);
    expect(Object.keys(persisted.state)).not.toEqual(
      expect.arrayContaining(["mode", "showFreezePrompt", "expandedCardId", "sparkBurst"])
    );
  });

  it("persists frozen card ids, reschedule queue, frozen card state, and proof record", () => {
    const deck = generateCourseDeckInStore();
    const firstCardId = deck.cards[0].id;

    storeState().freezeCurrentCard();
    const persisted = getPersistedState().state;
    const persistedDeck = persisted.deck?.decks.find((item) => item.id === deck.id);

    expect(persisted.deck?.frozenCardIds).toEqual([firstCardId]);
    expect(persisted.deck?.rescheduleQueue).toEqual([firstCardId]);
    expect(persistedDeck?.cards.find((card) => card.id === firstCardId)).toMatchObject({
      status: "frozen",
      damageEffect: "freeze"
    });
    expect(persisted.proofs?.records[0]).toMatchObject({
      status: "frozen",
      timeStatus: "frozen-rescheduled"
    });
  });

  it("persists completed card ids, completed count, elapsed seconds, and completion proof", () => {
    const deck = generateCourseDeckInStore();
    const firstCardId = deck.cards[0].id;

    storeState().completeCurrentCard("button");
    const persisted = getPersistedState().state;
    const persistedDeck = persisted.deck?.decks.find((item) => item.id === deck.id);
    const completedCard = persistedDeck?.cards.find((card) => card.id === firstCardId);

    expect(persisted.deck?.completedCardIds).toContain(firstCardId);
    expect(persistedDeck?.completedCards).toBe(1);
    expect(completedCard?.status).toBe("completed");
    expect(completedCard?.elapsedSeconds).toBeGreaterThan(0);
    expect(persisted.proofs?.records[0]).toMatchObject({
      status: "completed",
      completedCards: 1
    });
  });

  it("persists reward cards and completed deck state after the full deck is completed", () => {
    const deck = generateCourseDeckInStore();

    completeActiveDeck();
    const persisted = getPersistedState().state;
    const persistedDeck = persisted.deck?.decks.find((item) => item.id === deck.id);

    expect(persisted.deck?.rewardCards).toHaveLength(1);
    expect(persisted.deck?.rewardCards[0]).toMatchObject({
      deckId: deck.id,
      title: "去高数课 已变成行动证据"
    });
    expect(persistedDeck?.deckStatus).toBe("completed");
    expect(persisted.proofs?.records[0].status).toBe("rewarded");
  });

  it("does not require UI-only state to restore the active deck", () => {
    generateCourseDeckInStore();
    const persisted = getPersistedState().state;

    expect(Object.keys(persisted)).toEqual(
      expect.arrayContaining(["inputs", "analysis", "analysisStatus", "plans", "taskFlow", "deck", "proofs"])
    );
    expect(Object.keys(persisted)).not.toContain("showFreezePrompt");
    expect(getActiveDeck().cards.filter((card) => card.status === "active")).toHaveLength(1);
  });
});

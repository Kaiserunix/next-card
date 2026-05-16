import { describe, it, expect, beforeEach } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import {
  resetNextCardStore,
  generateCourseDeckInStore,
} from "@/tests/helpers/nextCardStore";

const STORAGE_KEY = "next-card-mvp";

function readPersisted() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  expect(raw).not.toBeNull();
  return JSON.parse(raw!);
}

describe("localStorage persistence (next-card-mvp)", () => {
  beforeEach(() => {
    resetNextCardStore();
  });

  it("after generating a deck, persists inputs / analysis / plans / taskFlow / deck / proofs", () => {
    generateCourseDeckInStore();
    const dump = readPersisted();
    const state = dump.state;

    expect(state.inputs.text).toBe("去高数课");
    expect(state.analysis).not.toBeNull();
    expect(state.plans.options).toHaveLength(3);
    expect(state.taskFlow).not.toBeNull();
    expect(state.taskFlow.nodes.length).toBeGreaterThan(0);
    expect(state.deck.decks.length).toBe(1);
    expect(state.deck.activeDeckId).not.toBeNull();
    expect(state.deck.currentCardId).not.toBeNull();
    expect(state.proofs.records.length).toBeGreaterThan(0);
    expect(typeof state.proofs.summaryDocument).toBe("string");
  });

  it("after freezing a card, persists frozenCardIds, rescheduleQueue, frozen card status, frozen proof", () => {
    generateCourseDeckInStore();
    useNextCardStore.getState().freezeCurrentCard();

    const state = readPersisted().state;
    expect(state.deck.frozenCardIds.length).toBe(1);
    expect(state.deck.rescheduleQueue.length).toBe(1);

    const frozenId = state.deck.frozenCardIds[0];
    const frozenCard = state.deck.decks[0].cards.find((c: { id: string }) => c.id === frozenId);
    expect(frozenCard.status).toBe("frozen");
    expect(frozenCard.damageEffect).toBe("freeze");

    const newest = state.proofs.records[0];
    expect(newest.status).toBe("frozen");
    expect(newest.timeStatus).toBe("frozen-rescheduled");
  });

  it("after completing one card, persists completedCardIds, deck.completedCards, elapsedSeconds, completion proof", () => {
    generateCourseDeckInStore();
    useNextCardStore.getState().completeCurrentCard("right");

    const state = readPersisted().state;
    expect(state.deck.completedCardIds.length).toBe(1);
    expect(state.deck.decks[0].completedCards).toBe(1);
    const completedId = state.deck.completedCardIds[0];
    const completedCard = state.deck.decks[0].cards.find((c: { id: string }) => c.id === completedId);
    expect(completedCard.elapsedSeconds).toBeGreaterThan(0);

    const completionRecord = state.proofs.records.find(
      (r: { status: string }) => r.status === "completed",
    );
    expect(completionRecord).toBeDefined();
  });

  it("after completing the entire deck, persists rewardCards, deckStatus=completed, reward proof", () => {
    const deck = generateCourseDeckInStore();
    for (let i = 0; i < deck.cards.length; i++) {
      useNextCardStore.getState().completeCurrentCard("right");
    }

    const state = readPersisted().state;
    expect(state.deck.rewardCards.length).toBe(1);
    expect(state.deck.decks[0].deckStatus).toBe("completed");
    expect(state.proofs.records[0].status).toBe("rewarded");
  });

  it("does not persist 'mode' (UI-only state)", () => {
    generateCourseDeckInStore();
    useNextCardStore.getState().setMode("deck");
    const state = readPersisted().state;
    expect(state.mode).toBeUndefined();
  });
});

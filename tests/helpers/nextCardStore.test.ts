import { describe, it, expect, beforeEach } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import {
  resetNextCardStore,
  generateCourseDeckInStore,
  getActiveCard,
} from "@/tests/helpers/nextCardStore";

describe("nextCardStore helpers", () => {
  beforeEach(() => {
    resetNextCardStore();
  });

  it("resetNextCardStore restores default state", () => {
    const state = useNextCardStore.getState();
    expect(state.mode).toBe("input");
    expect(state.inputs.text).toBe("");
    expect(state.plans.options).toEqual([]);
    expect(state.deck.decks).toEqual([]);
    expect(state.proofs.records).toEqual([]);
  });

  it("generateCourseDeckInStore returns a course deck and active card", () => {
    const deck = generateCourseDeckInStore();
    expect(deck.coverTitle).toBe("去高数课");
    expect(deck.cards.length).toBeGreaterThan(0);

    const { deck: activeDeck, card } = getActiveCard();
    expect(activeDeck.id).toBe(deck.id);
    expect(card.deckId).toBe(deck.id);
  });

  it("getActiveCard throws when no active deck", () => {
    expect(() => getActiveCard()).toThrow();
  });
});

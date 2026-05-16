import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import { generateCourseDeckInStore, getActiveCard, resetNextCardStore } from "@/tests/helpers/nextCardStore";

const baseNow = new Date("2026-05-16T08:00:00.000Z");

describe("nextCardStore test helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetNextCardStore();
  });

  it("resetNextCardStore restores the default slices used by store tests", () => {
    const state = useNextCardStore.getState();

    expect(state.mode).toBe("input");
    expect(state.inputs.text).toBe("");
    expect(state.plans.options).toEqual([]);
    expect(state.taskFlow).toBeNull();
    expect(state.deck.decks).toEqual([]);
    expect(state.proofs.records).toEqual([]);
  });

  it("generateCourseDeckInStore returns the course deck and active card expected by backend tests", () => {
    const deck = generateCourseDeckInStore();
    const activeCard = getActiveCard();

    expect(deck.coverTitle).toBe("去高数课");
    expect(deck.coverIcon).toBe("course");
    expect(activeCard.deckId).toBe(deck.id);
    expect(activeCard.status).toBe("active");
  });

  it("getActiveCard throws when a test forgot to create or open a deck", () => {
    expect(() => getActiveCard()).toThrow("Expected an active deck");
  });
});

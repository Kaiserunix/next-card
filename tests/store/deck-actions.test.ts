import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeActiveDeck,
  generateCourseDeckInStore,
  getActiveCard,
  getActiveDeck,
  resetNextCardStore,
  storeState
} from "@/tests/helpers/nextCardStore";

const baseNow = new Date("2026-05-16T08:00:00.000Z");

describe("deck action state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetNextCardStore();
  });

  it("opens a deck and points currentCardId at its active card", () => {
    const deck = generateCourseDeckInStore();
    storeState().setMode("proof");

    storeState().openDeck(deck.id);

    expect(storeState().mode).toBe("deck");
    expect(storeState().deck.activeDeckId).toBe(deck.id);
    expect(storeState().deck.currentCardId).toBe(deck.cards[0].id);
  });

  it("opens a progressed deck at the card currently marked active", () => {
    const deck = generateCourseDeckInStore();
    storeState().completeCurrentCard("right");
    const activeCard = getActiveDeck().cards.find((card) => card.status === "active");
    storeState().setMode("proof");

    storeState().openDeck(deck.id);

    expect(activeCard).toBeDefined();
    expect(storeState().deck.currentCardId).toBe(activeCard?.id);
  });

  it("starts focus timing without increasing completion progress", () => {
    generateCourseDeckInStore();

    storeState().startFocusTiming();

    expect(storeState().deck.activeTimeMode).toBe("timing");
    expect(getActiveCard()).toMatchObject({
      startedAt: baseNow.toISOString(),
      status: "active"
    });
    expect(getActiveDeck().completedCards).toBe(0);
    expect(storeState().proofs.records[0]).toMatchObject({
      status: "in-progress",
      completedCards: 0,
      actualMinutes: 0
    });
    expect(storeState().proofs.records[0].timeDamageEvents).toContain("双击卡片，开始专注计时");
  });

  it("starts quick burning without auto-completing or failing the card", () => {
    generateCourseDeckInStore();
    const previousDamageProgress = getActiveCard().damageProgress;

    storeState().startQuickBurning();

    expect(storeState().deck.activeTimeMode).toBe("burning");
    expect(getActiveCard()).toMatchObject({
      urgencyStage: "burning",
      damageEffect: "burn",
      burnLevel: 3,
      status: "active"
    });
    expect(getActiveCard().damageProgress).toBeGreaterThan(previousDamageProgress);
    expect(getActiveDeck().completedCards).toBe(0);
    expect(storeState().proofs.records[0]).toMatchObject({
      status: "in-progress",
      completedCards: 0,
      lastDamageEffect: "burn"
    });
  });

  it("right swipe completion advances the card and records actual time", () => {
    const deck = generateCourseDeckInStore();
    const firstCardId = deck.cards[0].id;

    storeState().completeCurrentCard("right");

    const updatedDeck = getActiveDeck();
    expect(updatedDeck.completedCards).toBe(1);
    expect(updatedDeck.cards.find((card) => card.id === firstCardId)?.status).toBe("completed");
    expect(updatedDeck.cards[1].status).toBe("active");
    expect(storeState().deck.currentCardId).toBe(updatedDeck.cards[1].id);
    expect(storeState().deck.completedCardIds).toContain(firstCardId);
    expect(storeState().proofs.records[0].actualMinutes).toBeGreaterThan(0);
    expect(storeState().proofs.records[0].timeDamageEvents[0]).toContain("右滑完成卡片");
  });

  it("left swipe completion records the left direction in proof", () => {
    generateCourseDeckInStore();

    storeState().completeCurrentCard("left");

    expect(storeState().proofs.records[0].timeDamageEvents[0]).toContain("左滑完成卡片");
  });

  it("freezes the current card and adds it to the reschedule queue", () => {
    const deck = generateCourseDeckInStore();
    const firstCardId = deck.cards[0].id;

    storeState().freezeCurrentCard();

    const frozenCard = getActiveDeck().cards.find((card) => card.id === firstCardId);
    expect(frozenCard).toMatchObject({
      status: "frozen",
      damageEffect: "freeze",
      urgencyStage: "calm"
    });
    expect(storeState().deck.activeTimeMode).toBe("paused");
    expect(storeState().deck.frozenCardIds).toEqual([firstCardId]);
    expect(storeState().deck.rescheduleQueue).toEqual([firstCardId]);
    expect(storeState().proofs.records[0]).toMatchObject({
      status: "frozen",
      timeStatus: "frozen-rescheduled",
      lastDamageEffect: "freeze"
    });
  });

  it("continueCurrentCard only softens a paused state back to idle", () => {
    generateCourseDeckInStore();
    storeState().freezeCurrentCard();

    storeState().continueCurrentCard();

    expect(storeState().deck.activeTimeMode).toBe("idle");
  });

  it("completing the full deck creates one reward card and rewarded proof", () => {
    const deck = generateCourseDeckInStore();

    completeActiveDeck();

    const completedDeck = storeState().deck.decks.find((item) => item.id === deck.id);
    expect(completedDeck?.deckStatus).toBe("completed");
    expect(completedDeck?.completedCards).toBe(completedDeck?.totalCards);
    expect(storeState().deck.rewardCards).toHaveLength(1);
    expect(storeState().proofs.records[0]).toMatchObject({
      status: "rewarded",
      progress: 100,
      completedCards: deck.totalCards
    });
  });

  it("does not mutate deck state when no active deck exists", () => {
    storeState().startFocusTiming();
    storeState().startQuickBurning();
    storeState().completeCurrentCard("button");
    storeState().freezeCurrentCard();

    expect(storeState().deck.completedCardIds).toEqual([]);
    expect(storeState().deck.frozenCardIds).toEqual([]);
    expect(storeState().proofs.records).toEqual([]);
  });
});

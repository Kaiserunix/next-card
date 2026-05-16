import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateCourseDeckInStore,
  getActiveDeck,
  resetNextCardStore,
  storeState
} from "@/tests/helpers/nextCardStore";
import { useNextCardStore } from "@/store/useNextCardStore";

const baseNow = new Date("2026-05-16T08:00:00.000Z");

function addMinutes(minutes: number) {
  return new Date(baseNow.getTime() + minutes * 60_000).toISOString();
}

describe("active deck time refresh and reschedule queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetNextCardStore();
  });

  it("refreshes active deck card urgency without writing noisy proof records", () => {
    const deck = generateCourseDeckInStore();
    const firstCardId = deck.cards[0].id;
    const proofCount = storeState().proofs.records.length;

    storeState().refreshActiveDeckTime(addMinutes(7));

    const refreshedCard = getActiveDeck().cards.find((card) => card.id === firstCardId);
    expect(refreshedCard).toMatchObject({
      urgencyStage: "burning",
      damageEffect: "burn",
      burnLevel: 3,
      remainingSeconds: 60
    });
    expect(storeState().proofs.records).toHaveLength(proofCount);
  });

  it("preserves quick-burning visual state during active deck time refresh", () => {
    const deck = generateCourseDeckInStore();
    const activeCardId = deck.cards[0].id;

    storeState().startQuickBurning();
    useNextCardStore.setState((state) => ({
      deck: {
        ...state.deck,
        decks: state.deck.decks.map((item) =>
          item.id === deck.id
            ? {
                ...item,
                cards: item.cards.map((card) =>
                  card.id === activeCardId
                    ? {
                        ...card,
                        deadlineAt: addMinutes(30),
                        urgencyStage: "burning",
                        damageEffect: "burn",
                        damageProgress: 84,
                        burnLevel: 3
                      }
                    : card
                )
              }
            : item
        )
      }
    }));

    storeState().refreshActiveDeckTime(baseNow.toISOString());

    expect(getActiveDeck().cards.find((card) => card.id === activeCardId)).toMatchObject({
      urgencyStage: "calm",
      damageEffect: "burn",
      damageProgress: 84,
      burnLevel: 3,
      remainingSeconds: 1800
    });
  });

  it("ignores active deck time refresh when no active deck exists", () => {
    storeState().refreshActiveDeckTime(addMinutes(10));

    expect(storeState().deck.decks).toEqual([]);
    expect(storeState().deck.activeDeckId).toBeNull();
    expect(storeState().deck.currentCardId).toBeNull();
    expect(storeState().proofs.records).toEqual([]);
  });

  it("does not turn frozen or completed cards into expired cards during refresh", () => {
    const deck = generateCourseDeckInStore();
    const firstCardId = deck.cards[0].id;

    storeState().freezeCurrentCard();
    storeState().completeCurrentCard("button");
    storeState().refreshActiveDeckTime(addMinutes(60));

    const cards = getActiveDeck().cards;
    expect(cards.find((card) => card.id === firstCardId)).toMatchObject({
      status: "frozen",
      damageEffect: "freeze",
      urgencyStage: "calm"
    });
    expect(cards.find((card) => card.status === "completed")).toMatchObject({
      status: "completed"
    });
  });

  it("resumes a frozen card from the reschedule queue", () => {
    const deck = generateCourseDeckInStore();
    const frozenCardId = deck.cards[0].id;

    storeState().freezeCurrentCard();
    expect(storeState().deck.rescheduleQueue).toContain(frozenCardId);

    storeState().resumeFrozenCard(frozenCardId);

    const resumedDeck = getActiveDeck();
    const resumedCard = resumedDeck.cards.find((card) => card.id === frozenCardId);
    expect(storeState().deck.activeDeckId).toBe(deck.id);
    expect(storeState().deck.currentCardId).toBe(frozenCardId);
    expect(storeState().deck.rescheduleQueue).not.toContain(frozenCardId);
    expect(storeState().deck.frozenCardIds).not.toContain(frozenCardId);
    expect(storeState().deck.activeTimeMode).toBe("idle");
    expect(resumedCard).toMatchObject({
      status: "active",
      damageEffect: "none",
      damageProgress: 0,
      burnLevel: 0,
      urgencyStage: "warm",
      suggestedStartAt: baseNow.toISOString()
    });
    expect(resumedDeck.cards.filter((card) => card.status === "active")).toHaveLength(1);
    expect(storeState().proofs.records[0]).toMatchObject({
      status: "in-progress",
      timeStatus: "frozen-rescheduled",
      lastAction: "恢复冻结卡：确认高数课时间和教室"
    });
    expect(storeState().proofs.records[0].timeDamageEvents).toContain("从 reschedule queue 恢复冻结卡");
  });

  it("moves an existing active card back to queued when a frozen card resumes", () => {
    const deck = generateCourseDeckInStore();
    const frozenCardId = deck.cards[0].id;

    storeState().freezeCurrentCard();
    const activeBeforeResumeId = storeState().deck.currentCardId;
    storeState().resumeFrozenCard(frozenCardId);

    const resumedDeck = getActiveDeck();
    expect(resumedDeck.cards.find((card) => card.id === activeBeforeResumeId)?.status).toBe("queued");
    expect(resumedDeck.cards.filter((card) => card.status === "active")).toHaveLength(1);
  });

  it("resumes a frozen card from an inactive historical deck and makes that deck active", () => {
    const courseDeck = generateCourseDeckInStore();
    const frozenCardId = courseDeck.cards[0].id;
    storeState().freezeCurrentCard();

    storeState().setInputText("今晚 20:00 前交作业");
    storeState().analyzeInput();
    storeState().finishAnalysis();
    storeState().selectPlan("plan-1");
    const assignmentDeckId = storeState().deck.activeDeckId;
    expect(assignmentDeckId).not.toBe(courseDeck.id);

    storeState().resumeFrozenCard(frozenCardId);

    const resumedDeck = getActiveDeck();
    expect(storeState().deck.activeDeckId).toBe(courseDeck.id);
    expect(storeState().deck.currentCardId).toBe(frozenCardId);
    expect(resumedDeck.id).toBe(courseDeck.id);
    expect(resumedDeck.cards.find((card) => card.id === frozenCardId)).toMatchObject({
      status: "active",
      damageEffect: "none",
      urgencyStage: "warm"
    });
    expect(storeState().proofs.records[0]).toMatchObject({
      status: "in-progress",
      timeStatus: "frozen-rescheduled",
      nextSuggestion: expect.stringContaining("继续完成这张卡")
    });
  });

  it("ignores invalid or non-frozen resume requests without writing proof", () => {
    generateCourseDeckInStore();
    const proofCount = storeState().proofs.records.length;
    const activeCardId = storeState().deck.currentCardId;

    storeState().resumeFrozenCard("missing-card");
    storeState().resumeFrozenCard(activeCardId ?? "missing-active");

    expect(storeState().deck.currentCardId).toBe(activeCardId);
    expect(storeState().proofs.records).toHaveLength(proofCount);
  });
});

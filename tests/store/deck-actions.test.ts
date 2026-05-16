import { describe, it, expect, beforeEach } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import {
  resetNextCardStore,
  generateCourseDeckInStore,
  getActiveCard,
} from "@/tests/helpers/nextCardStore";

describe("deck action state machine", () => {
  beforeEach(() => {
    resetNextCardStore();
  });

  describe("openDeck", () => {
    it("sets mode=deck, activeDeckId, currentCardId", () => {
      const deck = generateCourseDeckInStore();
      useNextCardStore.getState().setMode("input");
      useNextCardStore.getState().openDeck(deck.id);

      const state = useNextCardStore.getState();
      expect(state.mode).toBe("deck");
      expect(state.deck.activeDeckId).toBe(deck.id);
      const activeOrFirst =
        deck.cards.find((card) => card.status === "active") ?? deck.cards[0];
      expect(state.deck.currentCardId).toBe(activeOrFirst.id);
    });
  });

  describe("startFocusTiming", () => {
    it("sets activeTimeMode=timing, writes startedAt, status=active, proof event", () => {
      generateCourseDeckInStore();
      const proofsBefore = useNextCardStore.getState().proofs.records.length;

      useNextCardStore.getState().startFocusTiming();

      const state = useNextCardStore.getState();
      const { card } = getActiveCard();
      expect(state.deck.activeTimeMode).toBe("timing");
      expect(card.startedAt).not.toBeNull();
      expect(card.status).toBe("active");
      expect(state.proofs.records.length).toBe(proofsBefore + 1);
      expect(state.proofs.records[0].timeDamageEvents.join("")).toContain("开始专注计时");
    });
  });

  describe("startQuickBurning", () => {
    it("sets activeTimeMode=burning, card to burning state, writes burn proof", () => {
      generateCourseDeckInStore();
      const proofsBefore = useNextCardStore.getState().proofs.records.length;

      useNextCardStore.getState().startQuickBurning();

      const state = useNextCardStore.getState();
      const { card } = getActiveCard();
      expect(state.deck.activeTimeMode).toBe("burning");
      expect(card.urgencyStage).toBe("burning");
      expect(card.damageEffect).toBe("burn");
      expect(card.burnLevel).toBe(3);
      expect(card.damageProgress).toBeGreaterThanOrEqual(84);
      expect(state.proofs.records.length).toBe(proofsBefore + 1);
      expect(state.proofs.records[0].lastDamageEffect).toBe("burn");
    });
  });

  describe("completeCurrentCard", () => {
    it("right swipe marks card completed, advances currentCardId, writes proof", () => {
      const deck = generateCourseDeckInStore();
      const before = getActiveCard();
      const proofsBefore = useNextCardStore.getState().proofs.records.length;

      useNextCardStore.getState().completeCurrentCard("right");

      const state = useNextCardStore.getState();
      const completedCard = state.deck.decks
        .find((d) => d.id === deck.id)!
        .cards.find((c) => c.id === before.card.id)!;

      expect(completedCard.status).toBe("completed");
      expect(state.deck.completedCardIds).toContain(before.card.id);
      const updatedDeck = state.deck.decks.find((d) => d.id === deck.id)!;
      expect(updatedDeck.completedCards).toBe(1);
      expect(state.deck.currentCardId).not.toBe(before.card.id);
      expect(state.proofs.records.length).toBeGreaterThanOrEqual(proofsBefore + 1);

      const newest = state.proofs.records[0];
      expect(newest.actualMinutes).toBeGreaterThan(0);
    });

    it("left swipe also marks card completed", () => {
      generateCourseDeckInStore();
      const before = getActiveCard();
      useNextCardStore.getState().completeCurrentCard("left");

      const state = useNextCardStore.getState();
      const card = state.deck.decks[0].cards.find((c) => c.id === before.card.id)!;
      expect(card.status).toBe("completed");
    });
  });

  describe("freezeCurrentCard", () => {
    it("status frozen, damageEffect freeze, queue + frozenCardIds updated, proof frozen", () => {
      generateCourseDeckInStore();
      const before = getActiveCard();

      useNextCardStore.getState().freezeCurrentCard();
      const state = useNextCardStore.getState();
      const frozen = state.deck.decks[0].cards.find((c) => c.id === before.card.id)!;

      expect(frozen.status).toBe("frozen");
      expect(frozen.damageEffect).toBe("freeze");
      expect(state.deck.frozenCardIds).toContain(before.card.id);
      expect(state.deck.rescheduleQueue).toContain(before.card.id);
      expect(state.deck.activeTimeMode).toBe("paused");
      expect(state.proofs.records[0].status).toBe("frozen");
      expect(state.proofs.records[0].timeStatus).toBe("frozen-rescheduled");
    });
  });

  describe("continueCurrentCard", () => {
    it("flips activeTimeMode from paused back to idle without writing proof", () => {
      generateCourseDeckInStore();
      useNextCardStore.getState().freezeCurrentCard();
      const proofsBefore = useNextCardStore.getState().proofs.records.length;
      expect(useNextCardStore.getState().deck.activeTimeMode).toBe("paused");

      useNextCardStore.getState().continueCurrentCard();

      const state = useNextCardStore.getState();
      expect(state.deck.activeTimeMode).toBe("idle");
      expect(state.proofs.records.length).toBe(proofsBefore);
    });
  });

  describe("complete entire deck", () => {
    it("deckStatus=completed, rewardCards added, latest proof rewarded", () => {
      const deck = generateCourseDeckInStore();
      const total = deck.cards.length;

      for (let i = 0; i < total; i++) {
        useNextCardStore.getState().completeCurrentCard("right");
      }

      const state = useNextCardStore.getState();
      const finalDeck = state.deck.decks.find((d) => d.id === deck.id)!;
      expect(finalDeck.deckStatus).toBe("completed");
      expect(state.deck.rewardCards.length).toBe(1);
      expect(state.proofs.records[0].status).toBe("rewarded");
    });
  });
});

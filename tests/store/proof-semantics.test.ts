import { describe, it, expect, beforeEach } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import {
  resetNextCardStore,
  generateCourseDeckInStore,
  getActiveCard,
} from "@/tests/helpers/nextCardStore";

describe("proof event semantics", () => {
  beforeEach(() => {
    resetNextCardStore();
  });

  describe("selectPlan", () => {
    it("writes in-progress / progress=0 / actualMinutes=0", () => {
      generateCourseDeckInStore();
      const newest = useNextCardStore.getState().proofs.records[0];
      expect(newest.status).toBe("in-progress");
      expect(newest.progress).toBe(0);
      expect(newest.actualMinutes).toBe(0);
    });

    it("never marks the first burning demo card as burning-completed", () => {
      generateCourseDeckInStore();
      const newest = useNextCardStore.getState().proofs.records[0];
      expect(newest.timeStatus).not.toBe("burning-completed");
      expect(newest.timeStatus).toBe("on-time");
    });

    it("flags the burn demo through lastDamageEffect, not timeStatus", () => {
      generateCourseDeckInStore();
      const newest = useNextCardStore.getState().proofs.records[0];
      expect(newest.lastDamageEffect).toBe("burn");
      expect(newest.timeDamageEvents.join("")).toContain("燃烧演示");
    });
  });

  describe("startFocusTiming", () => {
    it("is a timing event: status=in-progress, no completedCards bump", () => {
      const deck = generateCourseDeckInStore();
      const before = deck.completedCards;
      useNextCardStore.getState().startFocusTiming();
      const state = useNextCardStore.getState();
      const after = state.deck.decks[0].completedCards;
      expect(after).toBe(before);

      const newest = state.proofs.records[0];
      expect(newest.status).toBe("in-progress");
    });
  });

  describe("startQuickBurning", () => {
    it("is a burn event: lastDamageEffect=burn, completedCards unchanged, no immediate fail", () => {
      const deck = generateCourseDeckInStore();
      const before = deck.completedCards;
      useNextCardStore.getState().startQuickBurning();
      const state = useNextCardStore.getState();
      const newest = state.proofs.records[0];
      expect(newest.lastDamageEffect).toBe("burn");
      expect(state.deck.decks[0].completedCards).toBe(before);
      expect(newest.status).toBe("in-progress");
    });
  });

  describe("completeCurrentCard", () => {
    it("normal completion: completedCards++, progress up, actualMinutes>0, timeStatus=on-time", () => {
      generateCourseDeckInStore();
      const { card } = getActiveCard();
      // pick a non-burning card to test on-time path
      void card;
      // first card is the burning demo; complete the SECOND card instead
      useNextCardStore.getState().completeCurrentCard("right"); // burning demo card
      // proof for the burning demo completion is burning-completed; complete next normal card
      useNextCardStore.getState().completeCurrentCard("right");

      const records = useNextCardStore.getState().proofs.records;
      const onTime = records.find((r) => r.timeStatus === "on-time" && r.status === "completed");
      expect(onTime).toBeDefined();
      expect(onTime!.actualMinutes).toBeGreaterThan(0);
      expect(onTime!.progress).toBeGreaterThan(0);
    });

    it("burning completion: timeStatus=burning-completed when wasBurning", () => {
      generateCourseDeckInStore();
      // first card is burning demo
      useNextCardStore.getState().completeCurrentCard("right");

      const records = useNextCardStore.getState().proofs.records;
      const burnDone = records.find((r) => r.timeStatus === "burning-completed");
      expect(burnDone).toBeDefined();
    });
  });

  describe("freezeCurrentCard", () => {
    it("status=frozen, timeStatus=frozen-rescheduled, lastDamageEffect=freeze", () => {
      generateCourseDeckInStore();
      useNextCardStore.getState().freezeCurrentCard();
      const newest = useNextCardStore.getState().proofs.records[0];
      expect(newest.status).toBe("frozen");
      expect(newest.timeStatus).toBe("frozen-rescheduled");
      expect(newest.lastDamageEffect).toBe("freeze");
    });

    it("frozenCards count increases on the proof record", () => {
      generateCourseDeckInStore();
      useNextCardStore.getState().freezeCurrentCard();
      const newest = useNextCardStore.getState().proofs.records[0];
      expect(newest.frozenCards).toBeGreaterThan(0);
    });
  });

  describe("entire deck completion", () => {
    it("emits a rewardCard and a rewarded proof with progress=100", () => {
      const deck = generateCourseDeckInStore();
      for (let i = 0; i < deck.cards.length; i++) {
        useNextCardStore.getState().completeCurrentCard("right");
      }
      const state = useNextCardStore.getState();
      expect(state.deck.rewardCards.length).toBe(1);
      const newest = state.proofs.records[0];
      expect(newest.status).toBe("rewarded");
      expect(newest.progress).toBe(100);
    });

    it("rewardCard is only emitted after deck completion", () => {
      const deck = generateCourseDeckInStore();
      // complete only first card
      useNextCardStore.getState().completeCurrentCard("right");
      expect(useNextCardStore.getState().deck.rewardCards.length).toBe(0);

      // complete the rest
      for (let i = 1; i < deck.cards.length; i++) {
        useNextCardStore.getState().completeCurrentCard("right");
      }
      expect(useNextCardStore.getState().deck.rewardCards.length).toBe(1);
    });
  });
});

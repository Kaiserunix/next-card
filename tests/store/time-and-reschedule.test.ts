import { describe, it, expect, beforeEach } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import {
  resetNextCardStore,
  generateCourseDeckInStore,
  getActiveCard,
} from "@/tests/helpers/nextCardStore";

describe("refreshActiveDeckTime", () => {
  beforeEach(() => {
    resetNextCardStore();
  });

  it("does not write proof records when refreshing", () => {
    generateCourseDeckInStore();
    const proofsBefore = useNextCardStore.getState().proofs.records.length;

    useNextCardStore.getState().refreshActiveDeckTime();

    expect(useNextCardStore.getState().proofs.records.length).toBe(proofsBefore);
  });

  it("does nothing when no active deck", () => {
    const before = useNextCardStore.getState();
    useNextCardStore.getState().refreshActiveDeckTime();
    const after = useNextCardStore.getState();
    expect(after).toBe(before);
  });

  it("escalates urgencyStage to burning when deadline within 3 minutes", () => {
    generateCourseDeckInStore();
    const { card } = getActiveCard();

    const fakeNow = new Date(card.deadlineAt!);
    fakeNow.setMinutes(fakeNow.getMinutes() - 2);

    useNextCardStore.getState().refreshActiveDeckTime(fakeNow.toISOString());
    const refreshed = getActiveCard();
    expect(refreshed.card.urgencyStage).toBe("burning");
    expect(refreshed.card.damageEffect).toBe("burn");
  });

  it("does not flip frozen card to expired/crack", () => {
    generateCourseDeckInStore();
    useNextCardStore.getState().freezeCurrentCard();

    const state = useNextCardStore.getState();
    const frozenCard = state.deck.decks[0].cards.find((c) => c.status === "frozen")!;

    const futurePastDeadline = new Date();
    futurePastDeadline.setFullYear(futurePastDeadline.getFullYear() + 1);

    useNextCardStore.getState().refreshActiveDeckTime(futurePastDeadline.toISOString());

    const after = useNextCardStore
      .getState()
      .deck.decks[0].cards.find((c) => c.id === frozenCard.id)!;
    expect(after.status).toBe("frozen");
    expect(after.damageEffect).toBe("freeze");
  });
});

describe("resumeFrozenCard", () => {
  beforeEach(() => {
    resetNextCardStore();
  });

  it("restores frozen card to active, clears damage state, updates queue", () => {
    generateCourseDeckInStore();
    const beforeFreeze = getActiveCard();
    useNextCardStore.getState().freezeCurrentCard();
    expect(useNextCardStore.getState().deck.frozenCardIds).toContain(beforeFreeze.card.id);

    useNextCardStore.getState().resumeFrozenCard(beforeFreeze.card.id);

    const state = useNextCardStore.getState();
    const restored = state.deck.decks[0].cards.find((c) => c.id === beforeFreeze.card.id)!;

    expect(restored.status).toBe("active");
    expect(restored.damageEffect).toBe("none");
    expect(restored.damageProgress).toBe(0);
    expect(restored.burnLevel).toBe(0);
    expect(restored.urgencyStage).toBe("warm");
    expect(state.deck.frozenCardIds).not.toContain(beforeFreeze.card.id);
    expect(state.deck.rescheduleQueue).not.toContain(beforeFreeze.card.id);
    expect(state.deck.currentCardId).toBe(beforeFreeze.card.id);
    expect(state.deck.activeTimeMode).toBe("idle");
  });

  it("writes a frozen-rescheduled in-progress proof record", () => {
    generateCourseDeckInStore();
    const beforeFreeze = getActiveCard();
    useNextCardStore.getState().freezeCurrentCard();
    const proofsBefore = useNextCardStore.getState().proofs.records.length;

    useNextCardStore.getState().resumeFrozenCard(beforeFreeze.card.id);

    const state = useNextCardStore.getState();
    expect(state.proofs.records.length).toBe(proofsBefore + 1);
    const newest = state.proofs.records[0];
    expect(newest.status).toBe("in-progress");
    expect(newest.timeStatus).toBe("frozen-rescheduled");
    expect(newest.timeDamageEvents.join("")).toContain("恢复冻结卡");
    expect(newest.lastAction).toContain("恢复冻结卡");
  });

  it("demotes any other active card back to queued (no double active)", () => {
    const deck = generateCourseDeckInStore();
    const first = getActiveCard();
    useNextCardStore.getState().freezeCurrentCard();

    const stateAfterFreeze = useNextCardStore.getState();
    const newActive = stateAfterFreeze.deck.decks[0].cards.find((c) => c.status === "active");
    expect(newActive).toBeDefined();
    expect(newActive!.id).not.toBe(first.card.id);

    useNextCardStore.getState().resumeFrozenCard(first.card.id);

    const finalCards = useNextCardStore.getState().deck.decks[0].cards;
    const activeCount = finalCards.filter((c) => c.status === "active").length;
    expect(activeCount).toBe(1);
    expect(finalCards.find((c) => c.id === first.card.id)!.status).toBe("active");
    void deck;
  });

  it("invalid cardId is no-op (no proof, no state change)", () => {
    generateCourseDeckInStore();
    const before = useNextCardStore.getState();

    useNextCardStore.getState().resumeFrozenCard("does-not-exist");
    const after = useNextCardStore.getState();
    expect(after.proofs.records.length).toBe(before.proofs.records.length);
    expect(after.deck.decks).toEqual(before.deck.decks);
  });

  it("non-frozen card id is no-op", () => {
    generateCourseDeckInStore();
    const { card } = getActiveCard();
    const before = useNextCardStore.getState();

    useNextCardStore.getState().resumeFrozenCard(card.id);
    const after = useNextCardStore.getState();
    expect(after.proofs.records.length).toBe(before.proofs.records.length);
    expect(after.deck.frozenCardIds.length).toBe(before.deck.frozenCardIds.length);
  });
});

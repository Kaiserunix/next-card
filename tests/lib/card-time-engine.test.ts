import { describe, expect, it } from "vitest";
import { refreshCardTimeState, refreshDeckTimeState } from "@/lib/card-time-engine";
import type { TaskCard, TaskDeck } from "@/lib/types";

const baseNow = new Date("2026-05-16T08:00:00.000Z");

function addMinutes(minutes: number) {
  return new Date(baseNow.getTime() + minutes * 60_000).toISOString();
}

function makeCard(overrides: Partial<TaskCard> = {}): TaskCard {
  return {
    id: "card-1",
    deckId: "deck-1",
    flowNodeId: "flow-1",
    title: "确认高数课时间和教室",
    action: "打开来源信息，圈出时间、地点和必须完成的一个动作。",
    estimatedMinutes: 4,
    deadlineAt: addMinutes(30),
    suggestedStartAt: baseNow.toISOString(),
    startedAt: null,
    elapsedSeconds: 0,
    remainingSeconds: null,
    urgencyStage: "calm",
    damageEffect: "none",
    damageProgress: 0,
    burnLevel: 0,
    status: "active",
    encouragement: "先做这一小步。",
    cardBackNote: "保留上下文。",
    ...overrides
  };
}

function makeDeck(cards: TaskCard[]): TaskDeck {
  return {
    id: "deck-1",
    coverTitle: "去高数课",
    coverIcon: "course",
    deckStatus: "active",
    cards,
    totalCards: cards.length,
    completedCards: cards.filter((card) => card.status === "completed" || card.status === "rewarded").length
  };
}

describe("refreshCardTimeState", () => {
  it("keeps a card calm when its deadline is thirty minutes away", () => {
    const updated = refreshCardTimeState(makeCard({ deadlineAt: addMinutes(30) }), baseNow);

    expect(updated).toMatchObject({
      urgencyStage: "calm",
      damageEffect: "none",
      burnLevel: 0,
      remainingSeconds: 1800
    });
  });

  it("marks a card hot when its deadline is fifteen minutes away", () => {
    const updated = refreshCardTimeState(makeCard({ deadlineAt: addMinutes(15) }), baseNow);

    expect(updated).toMatchObject({
      urgencyStage: "hot",
      damageEffect: "burn",
      burnLevel: 2,
      damageProgress: 52,
      remainingSeconds: 900
    });
  });

  it("marks a card burning when its deadline is two minutes away", () => {
    const updated = refreshCardTimeState(makeCard({ deadlineAt: addMinutes(2) }), baseNow);

    expect(updated).toMatchObject({
      urgencyStage: "burning",
      damageEffect: "burn",
      burnLevel: 3,
      damageProgress: 86,
      remainingSeconds: 120
    });
  });

  it("marks an overdue card as expired with crack damage", () => {
    const updated = refreshCardTimeState(makeCard({ deadlineAt: addMinutes(-1) }), baseNow);

    expect(updated).toMatchObject({
      urgencyStage: "expired",
      damageEffect: "crack",
      burnLevel: 0,
      remainingSeconds: 0,
      damageProgress: 100
    });
  });

  it("does not rewrite cards without deadlines", () => {
    const card = makeCard({ deadlineAt: null, suggestedStartAt: addMinutes(10), urgencyStage: "warm" });

    expect(refreshCardTimeState(card, baseNow)).toBe(card);
  });

  it("does not damage frozen, completed, rewarded, or needs-review cards", () => {
    for (const status of ["frozen", "completed", "rewarded", "needs-review"] as const) {
      const card = makeCard({
        status,
        deadlineAt: addMinutes(-10),
        urgencyStage: status === "frozen" ? "calm" : "hot",
        damageEffect: status === "frozen" ? "freeze" : "burn"
      });

      expect(refreshCardTimeState(card, baseNow)).toBe(card);
    }
  });
});

describe("refreshDeckTimeState", () => {
  it("refreshes active and queued cards while preserving protected cards", () => {
    const active = makeCard({ id: "active", status: "active", deadlineAt: addMinutes(2) });
    const queued = makeCard({ id: "queued", status: "queued", deadlineAt: addMinutes(15) });
    const completed = makeCard({ id: "completed", status: "completed", deadlineAt: addMinutes(-5), urgencyStage: "warm" });
    const deck = makeDeck([active, queued, completed]);

    const updated = refreshDeckTimeState(deck, baseNow);

    expect(updated.cards.find((card) => card.id === "active")).toMatchObject({ urgencyStage: "burning" });
    expect(updated.cards.find((card) => card.id === "queued")).toMatchObject({ urgencyStage: "hot" });
    expect(updated.cards.find((card) => card.id === "completed")).toBe(completed);
    expect(updated.completedCards).toBe(deck.completedCards);
  });
});

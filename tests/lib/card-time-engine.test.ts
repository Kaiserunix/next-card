import { describe, it, expect } from "vitest";
import type { TaskCard, TaskDeck } from "@/lib/types";
import { refreshCardTimeState, refreshDeckTimeState } from "@/lib/card-time-engine";

const baseCard = (overrides: Partial<TaskCard> = {}): TaskCard => ({
  id: "card-1",
  deckId: "deck-1",
  flowNodeId: "flow-1",
  title: "测试卡",
  action: "执行测试",
  estimatedMinutes: 10,
  deadlineAt: null,
  suggestedStartAt: null,
  startedAt: null,
  elapsedSeconds: 0,
  remainingSeconds: null,
  urgencyStage: "calm",
  damageEffect: "none",
  damageProgress: 0,
  burnLevel: 0,
  status: "queued",
  encouragement: "",
  cardBackNote: "",
  ...overrides,
});

const isoIn = (minutes: number, base = new Date()) => {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
};

describe("refreshCardTimeState", () => {
  const now = new Date("2026-05-16T12:00:00Z");

  it("calm when 30 min remain", () => {
    const card = baseCard({ deadlineAt: isoIn(30, now) });
    const out = refreshCardTimeState(card, now);
    expect(out.urgencyStage).toBe("calm");
    expect(out.remainingSeconds).toBeGreaterThan(0);
  });

  it("hot when 15 min remain", () => {
    const card = baseCard({ deadlineAt: isoIn(15, now) });
    const out = refreshCardTimeState(card, now);
    expect(out.urgencyStage).toBe("hot");
    expect(out.damageEffect).toBe("burn");
    expect(out.burnLevel).toBeGreaterThanOrEqual(2);
  });

  it("burning when 2 min remain", () => {
    const card = baseCard({ deadlineAt: isoIn(2, now) });
    const out = refreshCardTimeState(card, now);
    expect(out.urgencyStage).toBe("burning");
    expect(out.damageEffect).toBe("burn");
    expect(out.burnLevel).toBe(3);
  });

  it("expired + crack when deadline passed", () => {
    const card = baseCard({ deadlineAt: isoIn(-5, now) });
    const out = refreshCardTimeState(card, now);
    expect(out.urgencyStage).toBe("expired");
    expect(out.damageEffect).toBe("crack");
    expect(out.remainingSeconds).toBe(0);
    expect(out.damageProgress).toBe(100);
  });

  it("frozen card is not refreshed by time", () => {
    const card = baseCard({
      deadlineAt: isoIn(-5, now),
      status: "frozen",
      damageEffect: "freeze",
      urgencyStage: "calm",
    });
    const out = refreshCardTimeState(card, now);
    expect(out.urgencyStage).toBe("calm");
    expect(out.damageEffect).toBe("freeze");
  });

  it("completed card is not refreshed", () => {
    const card = baseCard({
      deadlineAt: isoIn(-5, now),
      status: "completed",
      urgencyStage: "burning",
    });
    const out = refreshCardTimeState(card, now);
    expect(out.urgencyStage).toBe("burning");
    expect(out.damageEffect).toBe("none");
  });

  it("returns same reference when no deadline (no-op)", () => {
    const card = baseCard({ deadlineAt: null });
    const out = refreshCardTimeState(card, now);
    expect(out).toBe(card);
  });
});

describe("refreshDeckTimeState", () => {
  const now = new Date("2026-05-16T12:00:00Z");

  it("refreshes only refreshable cards in a deck", () => {
    const deck: TaskDeck = {
      id: "deck-1",
      coverTitle: "test",
      coverIcon: "spark",
      deckStatus: "active",
      totalCards: 3,
      completedCards: 1,
      cards: [
        baseCard({ id: "c1", status: "completed", deadlineAt: isoIn(-30, now) }),
        baseCard({ id: "c2", status: "active", deadlineAt: isoIn(2, now) }),
        baseCard({ id: "c3", status: "queued", deadlineAt: isoIn(30, now) }),
      ],
    };

    const out = refreshDeckTimeState(deck, now);
    expect(out.cards[0].urgencyStage).toBe("calm");
    expect(out.cards[1].urgencyStage).toBe("burning");
    expect(out.cards[2].urgencyStage).toBe("calm");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeActiveDeck,
  generateCourseDeckInStore,
  resetNextCardStore,
  storeState
} from "@/tests/helpers/nextCardStore";

const baseNow = new Date("2026-05-16T08:00:00.000Z");

describe("proof event semantics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetNextCardStore();
  });

  it("records plan selection as in-progress and does not count the burning demo as completed", () => {
    generateCourseDeckInStore();

    expect(storeState().proofs.records[0]).toMatchObject({
      status: "in-progress",
      progress: 0,
      completedCards: 0,
      frozenCards: 0,
      actualMinutes: 0,
      timeStatus: "on-time",
      lastDamageEffect: "burn"
    });
    expect(storeState().proofs.records[0].timeDamageEvents).toContain("生成第一张近截止燃烧演示卡");
  });

  it("records focus timing as a timing event without increasing completion", () => {
    generateCourseDeckInStore();
    storeState().startFocusTiming();

    expect(storeState().proofs.records[0]).toMatchObject({
      status: "in-progress",
      progress: 0,
      completedCards: 0,
      actualMinutes: 0,
      timeStatus: "on-time"
    });
    expect(storeState().proofs.records[0].timeDamageEvents).toContain("双击卡片，开始专注计时");
  });

  it("records quick burning as a burn event without completing or failing the card", () => {
    generateCourseDeckInStore();
    storeState().startQuickBurning();

    expect(storeState().proofs.records[0]).toMatchObject({
      status: "in-progress",
      progress: 0,
      completedCards: 0,
      actualMinutes: 0,
      timeStatus: "on-time",
      lastDamageEffect: "burn"
    });
    expect(storeState().proofs.records[0].timeDamageEvents).toContain("三击进入快速燃烧模式");
  });

  it("keeps proof summary aggregates from counting planning, timing, or burn-start events as outcomes", () => {
    generateCourseDeckInStore();
    storeState().startFocusTiming();
    storeState().startQuickBurning();

    expect(storeState().proofs.records.map((record) => record.status)).toEqual([
      "in-progress",
      "in-progress",
      "in-progress"
    ]);
    expect(storeState().proofs.summaryDocument).toContain("0 个目标进入完成或奖励状态");
    expect(storeState().proofs.summaryDocument).toContain("0 张卡片被温柔冻结");
    expect(storeState().proofs.summaryDocument).toContain("0 张卡片上使用了燃烧节奏");
  });

  it("records burning completion only after the card is completed in burning mode", () => {
    generateCourseDeckInStore();
    storeState().startQuickBurning();
    storeState().completeCurrentCard("right");

    expect(storeState().proofs.records[0]).toMatchObject({
      status: "completed",
      progress: 20,
      completedCards: 1,
      actualMinutes: expect.any(Number),
      timeStatus: "burning-completed",
      lastDamageEffect: "burn"
    });
    expect(storeState().proofs.records[0].actualMinutes).toBeGreaterThan(0);
  });

  it("records freezing as frozen-rescheduled with a freeze damage event", () => {
    generateCourseDeckInStore();
    storeState().freezeCurrentCard();

    expect(storeState().proofs.records[0]).toMatchObject({
      status: "frozen",
      frozenCards: 1,
      timeStatus: "frozen-rescheduled",
      lastDamageEffect: "freeze"
    });
  });

  it("records a rewarded proof only when the full deck is completed", () => {
    generateCourseDeckInStore();

    expect(storeState().deck.rewardCards).toHaveLength(0);
    completeActiveDeck();

    expect(storeState().deck.rewardCards).toHaveLength(1);
    expect(storeState().proofs.records[0]).toMatchObject({
      status: "rewarded",
      progress: 100
    });
    expect(storeState().proofs.records[0].timeDamageEvents).toContain("奖励卡生成");
  });
});

import { describe, expect, it } from "vitest";
import { analyzeFrozenTaskReturn } from "@/lib/server/freeze-return-agent";
import type { FrozenTaskEntry, QueueItem, TaskCard } from "@/lib/types";

const now = "2026-05-17T10:00:00.000Z";

function card(overrides: Partial<TaskCard> = {}): TaskCard {
  return {
    id: overrides.id ?? "card-frozen",
    deckId: overrides.deckId ?? "deck-1",
    agentId: overrides.agentId ?? "gentle-recovery",
    agentName: overrides.agentName ?? "温和恢复师",
    flowNodeId: overrides.flowNodeId ?? "flow-1",
    title: overrides.title ?? "补回高数作业第一步",
    action: overrides.action ?? "打开上次作业页，只标出第一道要补的题。",
    estimatedMinutes: overrides.estimatedMinutes ?? 18,
    deadlineAt: overrides.deadlineAt ?? "2026-05-17T11:00:00.000Z",
    suggestedStartAt: overrides.suggestedStartAt ?? now,
    startedAt: null,
    elapsedSeconds: 0,
    remainingSeconds: null,
    urgencyStage: overrides.urgencyStage ?? "warm",
    damageEffect: overrides.damageEffect ?? "freeze",
    damageProgress: overrides.damageProgress ?? 20,
    burnLevel: overrides.burnLevel ?? 0,
    status: overrides.status ?? "frozen",
    encouragement: "重新接回即可。",
    cardBackNote: "冻结上下文已保存。"
  };
}

function frozen(overrides: Partial<FrozenTaskEntry> = {}): FrozenTaskEntry {
  return {
    id: overrides.id ?? "freeze-1",
    card: overrides.card ?? card(),
    deckTitle: overrides.deckTitle ?? "高数作业",
    frozenAt: overrides.frozenAt ?? "2026-05-17T08:00:00.000Z",
    returnAfter: overrides.returnAfter ?? "2026-05-17T09:30:00.000Z",
    reason: overrides.reason ?? "用户选择先冻结。",
    minReentryMinutes: overrides.minReentryMinutes ?? 8,
    contextSnapshot: overrides.contextSnapshot ?? ["作业页已打开", "下一步是第一道题"]
  };
}

function queueItem(overrides: Partial<QueueItem>): QueueItem {
  return {
    id: overrides.id ?? "urgent",
    title: overrides.title ?? "当前更急任务",
    kind: overrides.kind ?? "card",
    status: overrides.status ?? "queued",
    source: "text",
    createdAt: "2026-05-17T09:00:00.000Z",
    estimatedMinutes: overrides.estimatedMinutes ?? 6,
    deadlineAt: overrides.deadlineAt,
    suggestedStartAt: overrides.suggestedStartAt,
    urgencyStage: overrides.urgencyStage ?? "hot",
    behaviorVector: overrides.behaviorVector,
    timeLocks: overrides.timeLocks ?? []
  };
}

describe("freeze return agent", () => {
  it("keeps waiting when the frozen card has not reached returnAfter", () => {
    const decision = analyzeFrozenTaskReturn({
      now: "2026-05-17T09:00:00.000Z",
      entry: frozen({ returnAfter: "2026-05-17T09:30:00.000Z" }),
      currentQueue: []
    });

    expect(decision.action.kind).toBe("keep-waiting");
    expect(decision.restoredCard).toBeUndefined();
  });

  it("returns the original frozen card when the queue is clear enough", () => {
    const entry = frozen();
    const decision = analyzeFrozenTaskReturn({ now, entry, currentQueue: [] });

    expect(decision.action).toMatchObject({
      kind: "return-frozen-card",
      targetId: entry.card.id,
      respectsLocks: true
    });
    expect(decision.restoredCard).toMatchObject({
      id: entry.card.id,
      status: "active",
      damageEffect: "none",
      urgencyStage: "warm"
    });
  });

  it("does not recover a frozen card over a much more urgent current card", () => {
    const decision = analyzeFrozenTaskReturn({
      now,
      entry: frozen({ card: card({ deadlineAt: "2026-05-17T18:00:00.000Z" }) }),
      currentQueue: [
        queueItem({
          id: "exam-submit",
          deadlineAt: "2026-05-17T10:15:00.000Z",
          urgencyStage: "burning",
          behaviorVector: {
            expectancy: 70,
            taskValue: 96,
            procrastination: 35,
            timePressure: 98,
            reasons: ["当前队列已有更急任务。"]
          }
        })
      ]
    });

    expect(decision.action.kind).toBe("create-reminder");
    expect(decision.action.targetId).toBe("card-frozen");
    expect(decision.reason).toContain("更急");
  });

  it("splits a large frozen card into a smaller reentry card near deadline", () => {
    const entry = frozen({
      card: card({
        estimatedMinutes: 30,
        deadlineAt: "2026-05-17T10:25:00.000Z",
        title: "补完全部高数作业"
      }),
      minReentryMinutes: 7
    });
    const decision = analyzeFrozenTaskReturn({ now, entry, currentQueue: [] });

    expect(decision.action.kind).toBe("split-frozen-card");
    expect(decision.restoredCard?.title).toContain("回归");
    expect(decision.restoredCard?.estimatedMinutes).toBeLessThanOrEqual(7);
    expect(decision.restoredCard?.cardBackNote).toContain("原冻结任务");
  });
});

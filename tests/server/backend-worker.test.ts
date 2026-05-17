import { describe, expect, it } from "vitest";
import { runBackendWorkerTick } from "@/lib/server/backend-worker";
import type { BackendWorkerSnapshot, FrozenTaskEntry, QueueItem, TaskCard } from "@/lib/types";

const now = "2026-05-17T10:00:00.000Z";

function queueItem(id: string, deadlineAt: string): QueueItem {
  return {
    id,
    title: id,
    kind: "card",
    status: "queued",
    source: "text",
    createdAt: "2026-05-17T09:00:00.000Z",
    estimatedMinutes: 8,
    deadlineAt,
    urgencyStage: "hot",
    timeLocks: []
  };
}

function frozenCard(): TaskCard {
  return {
    id: "frozen-card",
    deckId: "deck-1",
    agentId: "gentle-recovery",
    agentName: "温和恢复师",
    flowNodeId: "flow-1",
    title: "冻结后的回归卡",
    action: "只恢复上下文。",
    estimatedMinutes: 6,
    deadlineAt: "2026-05-17T11:00:00.000Z",
    suggestedStartAt: now,
    startedAt: null,
    elapsedSeconds: 0,
    remainingSeconds: null,
    urgencyStage: "warm",
    damageEffect: "freeze",
    damageProgress: 20,
    burnLevel: 0,
    status: "frozen",
    encouragement: "接回来即可。",
    cardBackNote: "冻结上下文已保存。"
  };
}

function snapshot(overrides: Partial<BackendWorkerSnapshot> = {}): BackendWorkerSnapshot {
  const frozenEntry: FrozenTaskEntry = {
    id: "freeze-1",
    card: frozenCard(),
    deckTitle: "高数",
    frozenAt: "2026-05-17T08:00:00.000Z",
    returnAfter: "2026-05-17T09:30:00.000Z",
    reason: "用户冻结",
    minReentryMinutes: 6,
    contextSnapshot: ["已保存上下文"]
  };

  return {
    now,
    queueItems: [queueItem("urgent-card", "2026-05-17T10:20:00.000Z")],
    activeQueue: ["urgent-card"],
    timeLocks: [],
    frozenTasks: [frozenEntry],
    hiddenGoals: [],
    processedActionIds: [],
    ...overrides
  };
}

describe("backend worker tick", () => {
  it("combines schedule planning and freeze-return decisions into idempotent backend actions", () => {
    const result = runBackendWorkerTick(snapshot());

    expect(result.tickId).toContain("worker-2026-05-17T10-00-00");
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "deal-card", targetId: "urgent-card" }),
        expect.objectContaining({ kind: "return-frozen-card", targetId: "frozen-card" })
      ])
    );
    expect(new Set(result.actions.map((action) => action.id)).size).toBe(result.actions.length);
  });

  it("does not emit already processed action ids twice", () => {
    const first = runBackendWorkerTick(snapshot());
    const second = runBackendWorkerTick(snapshot({ processedActionIds: first.actions.map((action) => action.id) }));

    expect(second.actions).toHaveLength(0);
    expect(second.skippedActionIds).toEqual(first.actions.map((action) => action.id));
  });
});

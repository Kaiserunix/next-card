import { describe, expect, it } from "vitest";
import { createSchedulePlan } from "@/lib/server/schedule-planner";
import type { QueueItem, SchedulePlannerInput, TimeLock } from "@/lib/types";

const now = "2026-05-17T08:00:00.000Z";

function item(overrides: Partial<QueueItem>): QueueItem {
  return {
    id: overrides.id ?? "item-1",
    title: overrides.title ?? "测试卡",
    kind: overrides.kind ?? "card",
    status: overrides.status ?? "queued",
    source: overrides.source ?? "text",
    createdAt: overrides.createdAt ?? "2026-05-17T07:00:00.000Z",
    estimatedMinutes: overrides.estimatedMinutes ?? 10,
    deadlineAt: overrides.deadlineAt,
    suggestedStartAt: overrides.suggestedStartAt,
    urgencyStage: overrides.urgencyStage ?? "calm",
    position: overrides.position,
    deckId: overrides.deckId,
    cardId: overrides.cardId,
    hidden: overrides.hidden,
    calendarSync: overrides.calendarSync,
    reminderSync: overrides.reminderSync,
    frozenAt: overrides.frozenAt,
    returnAfter: overrides.returnAfter,
    behaviorVector: overrides.behaviorVector,
    timeLocks: overrides.timeLocks ?? []
  };
}

function lock(overrides: Partial<TimeLock>): TimeLock {
  return {
    id: overrides.id ?? "lock-1",
    targetId: overrides.targetId ?? "item-1",
    targetType: overrides.targetType ?? "card",
    kind: overrides.kind ?? "notebook-fixed",
    strength: overrides.strength ?? "hard",
    startsAt: overrides.startsAt ?? "2026-05-17T08:30:00.000Z",
    endsAt: overrides.endsAt ?? "2026-05-17T09:00:00.000Z",
    lockedAt: overrides.lockedAt ?? "2026-05-17T07:20:00.000Z",
    reason: overrides.reason ?? "用户写进记事本，不能被 agent 改时间。",
    canAgentMove: overrides.canAgentMove ?? false,
    canAgentSuggest: overrides.canAgentSuggest ?? true
  };
}

function plan(input: Partial<SchedulePlannerInput>) {
  return createSchedulePlan({
    now,
    items: [],
    activeQueue: [],
    timeLocks: [],
    maxDealCards: 2,
    ...input
  });
}

describe("schedule planner", () => {
  it("scores light-heavy-urgent-slow factors and never silently moves hard notebook locks", () => {
    const fixedMath = item({
      id: "math-class",
      title: "08:30 高数课",
      kind: "calendar-event",
      deadlineAt: "2026-05-17T08:30:00.000Z",
      urgencyStage: "hot",
      position: 1
    });
    const hardLock = lock({ id: "notebook-math", targetId: fixedMath.id, targetType: "calendar-event" });
    const report = item({
      id: "report",
      title: "整理课程报告草稿",
      deadlineAt: "2026-05-17T12:00:00.000Z",
      position: 0,
      behaviorVector: {
        expectancy: 52,
        taskValue: 72,
        procrastination: 64,
        timePressure: 68,
        reasons: ["有截止，但不是当前硬固定安排。"]
      }
    });

    const result = plan({ items: [report, fixedMath], activeQueue: [report.id, fixedMath.id], timeLocks: [hardLock] });

    expect(result.priorityVectors[fixedMath.id].urgency).toBeGreaterThan(result.priorityVectors[report.id].urgency);
    expect(result.priorityVectors[fixedMath.id].userLockPenalty).toBeGreaterThan(0);
    expect(result.orderedQueue[1]).toBe(fixedMath.id);
    expect(result.actions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "move-task", targetId: fixedMath.id })])
    );
    expect(result.lockedConflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ targetId: fixedMath.id, lockId: hardLock.id })])
    );
  });

  it("reveals hidden future goals through a user-review action instead of silent insertion", () => {
    const hiddenGoal = item({
      id: "hidden-cet",
      title: "英语四级报名提醒",
      kind: "hidden-goal",
      hidden: true,
      deadlineAt: "2026-05-17T09:00:00.000Z",
      urgencyStage: "hot",
      behaviorVector: {
        expectancy: 78,
        taskValue: 80,
        procrastination: 40,
        timePressure: 88,
        reasons: ["隐藏未来任务到达提醒窗口。"]
      }
    });

    const result = plan({ items: [hiddenGoal] });

    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "reveal-hidden-goal",
          targetId: hiddenGoal.id,
          requiresUserReview: true,
          respectsLocks: true
        })
      ])
    );
  });

  it("deals at most the first one or two eligible cards and leaves the rest for background ordering", () => {
    const items = Array.from({ length: 5 }, (_, index) =>
      item({
        id: `card-${index + 1}`,
        title: `可发牌任务 ${index + 1}`,
        deadlineAt: `2026-05-17T0${9 + index}:00:00.000Z`,
        urgencyStage: index < 2 ? "hot" : "warm",
        position: index
      })
    );

    const result = plan({ items, maxDealCards: 2 });
    const dealActions = result.actions.filter((action) => action.kind === "deal-card");

    expect(dealActions).toHaveLength(2);
    expect(dealActions.every((action) => action.position !== undefined && action.position <= 1)).toBe(true);
    expect(result.actions.filter((action) => action.kind === "insert-task").length).toBeGreaterThanOrEqual(3);
  });

  it("creates reminder and calendar sync actions through explicit backend actions", () => {
    const reminderCard = item({
      id: "leave-home",
      title: "出门去高数课",
      deadlineAt: "2026-05-17T08:20:00.000Z",
      urgencyStage: "burning",
      reminderSync: "wanted"
    });
    const calendarCard = item({
      id: "lab",
      title: "物理实验课",
      kind: "calendar-event",
      suggestedStartAt: "2026-05-17T10:00:00.000Z",
      calendarSync: "wanted"
    });

    const result = plan({ items: [reminderCard, calendarCard] });

    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "create-reminder", targetId: reminderCard.id }),
        expect.objectContaining({ kind: "create-calendar-event", targetId: calendarCard.id })
      ])
    );
  });
});

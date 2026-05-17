import { describe, expect, it } from "vitest";
import { runBackendWorkerTick } from "@/lib/server/backend-worker";
import { analyzeFrozenTaskReturn } from "@/lib/server/freeze-return-agent";
import { runFreezeReturnSweep } from "@/lib/server/freeze-sweep";
import { createSchedulePlan } from "@/lib/server/schedule-planner";
import type { BackendWorkerSnapshot, FrozenTaskEntry, QueueItem, SchedulePlannerInput, TaskCard, TimeLock } from "@/lib/types";

const now = "2026-05-17T10:00:00.000Z";

function queueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: overrides.id ?? "item-1",
    title: overrides.title ?? "测试任务",
    kind: overrides.kind ?? "card",
    status: overrides.status ?? "queued",
    source: overrides.source ?? "text",
    createdAt: overrides.createdAt ?? "2026-05-17T08:00:00.000Z",
    estimatedMinutes: overrides.estimatedMinutes ?? 10,
    deadlineAt: overrides.deadlineAt,
    suggestedStartAt: overrides.suggestedStartAt,
    urgencyStage: overrides.urgencyStage ?? "warm",
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

function timeLock(overrides: Partial<TimeLock> = {}): TimeLock {
  return {
    id: overrides.id ?? "lock-1",
    targetId: overrides.targetId ?? "item-1",
    targetType: overrides.targetType ?? "card",
    kind: overrides.kind ?? "notebook-fixed",
    strength: overrides.strength ?? "hard",
    startsAt: overrides.startsAt ?? "2026-05-17T10:30:00.000Z",
    endsAt: overrides.endsAt ?? "2026-05-17T11:00:00.000Z",
    lockedAt: overrides.lockedAt ?? "2026-05-17T08:30:00.000Z",
    reason: overrides.reason ?? "用户固定时间，agent 不能静默移动。",
    canAgentMove: overrides.canAgentMove ?? false,
    canAgentSuggest: overrides.canAgentSuggest ?? true
  };
}

function taskCard(overrides: Partial<TaskCard> = {}): TaskCard {
  return {
    id: overrides.id ?? "frozen-card",
    deckId: overrides.deckId ?? "deck-1",
    agentId: overrides.agentId ?? "gentle-recovery",
    agentName: overrides.agentName ?? "温和恢复师",
    flowNodeId: overrides.flowNodeId ?? "flow-1",
    title: overrides.title ?? "冻结任务回归",
    action: overrides.action ?? "先恢复上下文，再完成一个小动作。",
    estimatedMinutes: overrides.estimatedMinutes ?? 8,
    deadlineAt: overrides.deadlineAt ?? "2026-05-17T11:30:00.000Z",
    suggestedStartAt: overrides.suggestedStartAt ?? null,
    startedAt: overrides.startedAt ?? null,
    elapsedSeconds: overrides.elapsedSeconds ?? 0,
    remainingSeconds: overrides.remainingSeconds ?? null,
    urgencyStage: overrides.urgencyStage ?? "warm",
    damageEffect: overrides.damageEffect ?? "freeze",
    damageProgress: overrides.damageProgress ?? 25,
    burnLevel: overrides.burnLevel ?? 0,
    status: overrides.status ?? "frozen",
    encouragement: overrides.encouragement ?? "接回来就好。",
    cardBackNote: overrides.cardBackNote ?? "冻结上下文已保存。"
  };
}

function frozenTask(overrides: Partial<FrozenTaskEntry> = {}): FrozenTaskEntry {
  return {
    id: overrides.id ?? "freeze-1",
    card: overrides.card ?? taskCard(),
    deckTitle: overrides.deckTitle ?? "长期任务",
    frozenAt: overrides.frozenAt ?? "2026-05-17T08:00:00.000Z",
    returnAfter: overrides.returnAfter ?? "2026-05-17T09:30:00.000Z",
    reason: overrides.reason ?? "用户选择先冻结。",
    minReentryMinutes: overrides.minReentryMinutes ?? 6,
    contextSnapshot: overrides.contextSnapshot ?? ["已保存页面", "下一步只做 6 分钟"]
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

function snapshot(overrides: Partial<BackendWorkerSnapshot> = {}): BackendWorkerSnapshot {
  return {
    now,
    queueItems: [],
    activeQueue: [],
    timeLocks: [],
    frozenTasks: [],
    hiddenGoals: [],
    processedActionIds: [],
    ...overrides
  };
}

describe("schedule/freeze/worker stress lane", () => {
  it("keeps multiple hard locks fixed while soft-locked items can still be explicitly moved", () => {
    const fixedClass = queueItem({
      id: "fixed-class",
      title: "10:30 高数课",
      kind: "calendar-event",
      deadlineAt: "2026-05-17T10:30:00.000Z",
      urgencyStage: "burning",
      position: 0
    });
    const softReview = queueItem({
      id: "soft-review",
      title: "复习实验报告",
      deadlineAt: "2026-05-17T10:45:00.000Z",
      urgencyStage: "hot",
      position: 3
    });
    const hardSubmit = queueItem({
      id: "hard-submit",
      title: "11:00 固定提交窗口",
      deadlineAt: "2026-05-17T11:00:00.000Z",
      urgencyStage: "hot",
      position: 2
    });
    const filler = queueItem({
      id: "filler",
      title: "下午再处理的资料整理",
      deadlineAt: "2026-05-17T18:00:00.000Z",
      urgencyStage: "calm",
      position: 1
    });

    const result = plan({
      items: [fixedClass, filler, hardSubmit, softReview],
      activeQueue: ["fixed-class", "filler", "hard-submit", "soft-review"],
      timeLocks: [
        timeLock({ id: "fixed-class-lock", targetId: "fixed-class", targetType: "calendar-event" }),
        timeLock({ id: "hard-submit-lock", targetId: "hard-submit" }),
        timeLock({ id: "soft-review-lock", targetId: "soft-review", strength: "soft", kind: "deadline", canAgentMove: true })
      ]
    });

    expect(result.orderedQueue[0]).toBe("fixed-class");
    expect(result.orderedQueue[2]).toBe("hard-submit");
    expect(result.lockedConflicts.map((conflict) => conflict.targetId)).toEqual(["fixed-class", "hard-submit"]);
    expect(result.actions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "move-task", targetId: "fixed-class" }),
        expect.objectContaining({ kind: "move-task", targetId: "hard-submit" })
      ])
    );
    expect(result.actions).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "move-task", targetId: "soft-review" })]));
  });

  it("reveals hidden goals for review without counting them against the 1-2 card deal limit", () => {
    const visibleCards = Array.from({ length: 6 }, (_, index) =>
      queueItem({
        id: `visible-${index + 1}`,
        title: `可发牌任务 ${index + 1}`,
        deadlineAt: `2026-05-17T1${index}:20:00.000Z`,
        urgencyStage: index < 2 ? "hot" : "warm",
        position: index
      })
    );
    const hiddenGoal = queueItem({
      id: "hidden-scholarship",
      title: "奖学金材料隐藏提醒",
      kind: "hidden-goal",
      status: "hidden",
      hidden: true,
      deadlineAt: "2026-05-17T10:25:00.000Z",
      urgencyStage: "burning"
    });

    const result = plan({ items: [hiddenGoal, ...visibleCards], maxDealCards: 2 });
    const dealActions = result.actions.filter((action) => action.kind === "deal-card");

    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "reveal-hidden-goal",
          targetId: "hidden-scholarship",
          requiresUserReview: true,
          respectsLocks: true
        })
      ])
    );
    expect(dealActions).toHaveLength(2);
    expect(dealActions.map((action) => action.targetId)).not.toContain("hidden-scholarship");
  });

  it("reanalyzes a due frozen card against the current queue instead of treating returnAfter as a fixed reminder", () => {
    const entry = frozenTask({
      card: taskCard({
        id: "frozen-reading",
        title: "补读论文摘要",
        deadlineAt: "2026-05-17T18:00:00.000Z",
        estimatedMinutes: 12
      })
    });
    const urgentCurrent = queueItem({
      id: "exam-upload",
      title: "考试材料上传",
      deadlineAt: "2026-05-17T10:08:00.000Z",
      urgencyStage: "burning",
      behaviorVector: {
        expectancy: 80,
        taskValue: 98,
        procrastination: 20,
        timePressure: 100,
        reasons: ["当前更急。"]
      }
    });

    const blockedByQueue = analyzeFrozenTaskReturn({ now, entry, currentQueue: [urgentCurrent] });
    const clearQueue = analyzeFrozenTaskReturn({ now: "2026-05-17T10:20:00.000Z", entry, currentQueue: [] });

    expect(blockedByQueue.action).toMatchObject({
      kind: "create-reminder",
      targetId: "frozen-reading",
      scheduledFor: "2026-05-17T10:30:00.000Z"
    });
    expect(blockedByQueue.reason).toContain("更急");
    expect(clearQueue.action.kind).toBe("return-frozen-card");
    expect(clearQueue.restoredCard).toMatchObject({
      id: "frozen-reading",
      status: "active",
      damageEffect: "none",
      suggestedStartAt: "2026-05-17T10:20:00.000Z"
    });
  });

  it("sweeps mixed frozen states without letting waiting cards block due returns and splits", () => {
    const waiting = frozenTask({
      id: "freeze-waiting",
      card: taskCard({ id: "waiting-card", title: "明天再接的材料" }),
      returnAfter: "2026-05-17T12:00:00.000Z"
    });
    const dueReturn = frozenTask({
      id: "freeze-return",
      card: taskCard({ id: "return-card", title: "回归短任务", estimatedMinutes: 5, deadlineAt: "2026-05-17T15:00:00.000Z" })
    });
    const dueSplit = frozenTask({
      id: "freeze-split",
      card: taskCard({ id: "split-card", title: "过大的冻结任务", estimatedMinutes: 40, deadlineAt: "2026-05-17T10:35:00.000Z" }),
      minReentryMinutes: 7
    });

    const decisions = runFreezeReturnSweep({ now, frozenTasks: [waiting, dueReturn, dueSplit], currentQueue: [] });

    expect(decisions.map((decision) => decision.action.kind)).toEqual(["keep-waiting", "return-frozen-card", "split-frozen-card"]);
    expect(decisions[2].restoredCard).toMatchObject({
      id: "split-card",
      status: "active",
      estimatedMinutes: 7
    });
  });

  it("keeps worker ticks idempotent across repeated runs and still emits new actions when the clock advances", () => {
    const queueItems = [
      queueItem({ id: "burning-a", title: "先交最小版本", deadlineAt: "2026-05-17T10:12:00.000Z", urgencyStage: "burning" }),
      queueItem({ id: "hot-b", title: "整理引用", deadlineAt: "2026-05-17T10:45:00.000Z", urgencyStage: "hot" }),
      queueItem({ id: "warm-c", title: "写复盘", deadlineAt: "2026-05-17T16:00:00.000Z", urgencyStage: "warm" })
    ];
    const frozenTasks = [frozenTask({ card: taskCard({ id: "return-now", estimatedMinutes: 5 }) })];
    const first = runBackendWorkerTick(snapshot({ queueItems, frozenTasks }));
    const repeated = runBackendWorkerTick(snapshot({ queueItems, frozenTasks, processedActionIds: first.actions.map((action) => action.id) }));
    const later = runBackendWorkerTick(
      snapshot({
        now: "2026-05-17T10:05:00.000Z",
        queueItems,
        frozenTasks,
        processedActionIds: first.actions.map((action) => action.id)
      })
    );

    expect(first.actions.filter((action) => action.kind === "deal-card")).toHaveLength(2);
    expect(new Set(first.actions.map((action) => action.id)).size).toBe(first.actions.length);
    expect(repeated.actions).toHaveLength(0);
    expect(repeated.skippedActionIds).toEqual(first.actions.map((action) => action.id));
    expect(later.actions.length).toBeGreaterThan(0);
    expect(later.actions.every((action) => !first.actions.some((processed) => processed.id === action.id))).toBe(true);
  });

  it("runs a worker pass with queue, hidden goals, locks, frozen due items, and max two dealt cards", () => {
    const hardLocked = queueItem({
      id: "locked-calendar",
      title: "用户固定 10:30 课程",
      kind: "calendar-event",
      deadlineAt: "2026-05-17T10:30:00.000Z",
      urgencyStage: "burning",
      position: 0
    });
    const queueItems = [
      hardLocked,
      queueItem({ id: "report-min", title: "报告最低可交版", deadlineAt: "2026-05-17T10:18:00.000Z", urgencyStage: "burning" }),
      queueItem({ id: "slides", title: "补 3 页展示", deadlineAt: "2026-05-17T11:20:00.000Z", urgencyStage: "hot" }),
      queueItem({ id: "later-cleanup", title: "整理素材", deadlineAt: "2026-05-17T20:00:00.000Z", urgencyStage: "calm" })
    ];
    const hiddenGoals = [
      queueItem({
        id: "hidden-course-prep",
        title: "隐藏的课前准备",
        kind: "hidden-goal",
        status: "hidden",
        hidden: true,
        deadlineAt: "2026-05-17T10:40:00.000Z",
        urgencyStage: "hot"
      })
    ];
    const result = runBackendWorkerTick(
      snapshot({
        queueItems,
        hiddenGoals,
        activeQueue: ["locked-calendar", "later-cleanup", "slides", "report-min"],
        timeLocks: [timeLock({ id: "calendar-hard-lock", targetId: "locked-calendar", targetType: "calendar-event" })],
        frozenTasks: [
          frozenTask({ card: taskCard({ id: "return-short", estimatedMinutes: 5, deadlineAt: "2026-05-17T12:00:00.000Z" }) }),
          frozenTask({ card: taskCard({ id: "split-long", estimatedMinutes: 35, deadlineAt: "2026-05-17T10:28:00.000Z" }), minReentryMinutes: 6 })
        ]
      })
    );

    expect(result.schedule.lockedConflicts).toEqual([
      expect.objectContaining({ targetId: "locked-calendar", suggestedAction: "suggest-only" })
    ]);
    expect(result.actions).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: "move-task", targetId: "locked-calendar" })]));
    expect(result.actions).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "reveal-hidden-goal", targetId: "hidden-course-prep" })]));
    expect(result.actions.filter((action) => action.kind === "deal-card")).toHaveLength(2);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "return-frozen-card", targetId: "return-short" }),
        expect.objectContaining({ kind: "split-frozen-card", targetId: "split-long" })
      ])
    );
  });
});

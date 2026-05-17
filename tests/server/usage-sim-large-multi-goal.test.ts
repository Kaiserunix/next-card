import { describe, expect, it } from "vitest";
import { runBackendWorkerTick } from "@/lib/server/backend-worker";
import { createImportReview } from "@/lib/server/import-coverage";
import { createSchedulePlan } from "@/lib/server/schedule-planner";
import type { ImportedTopLevelCard, QueueItem, TimeLock } from "@/lib/types";

const importedAt = "2026-05-18T07:10:00.000Z";
const largeMultiGoalText = [
  "课程群通知：周一 08:00 高数课 二教304，老师要求带上次作业页",
  "周一 10:10 大学英语 三教201，听力小测",
  "DDL：周一 12:00 前提交计算机导论实验截图",
  "提醒：周一 12:20 给导师回复选题确认",
  "周一 14:00 物理实验 实验楼B201，提前 10 分钟到",
  "通知：周一 16:00 班会线上签到，不能迟到",
  "个人安排：周一 18:30 牙医复诊，已固定预约",
  "今晚 20:30 前完成线代作业第一版",
  "提醒：21:30 给妈妈打电话",
  "周二 08:00 体育课 操场，带校园卡",
  "周二 23:59 前提交英语作文",
  "明天 07:45 出门去高数课前检查教材、校园卡"
].join("\n");

function cardByFragment(cards: ImportedTopLevelCard[], fragment: string) {
  const card = cards.find((item) => item.sourceLine.includes(fragment));

  expect(card, `missing imported card containing ${fragment}`).toBeDefined();

  return card as ImportedTopLevelCard;
}

function isoForCard(card: ImportedTopLevelCard) {
  const line = card.sourceLine;

  if (line.includes("08:00 高数课")) {
    return "2026-05-18T08:00:00.000Z";
  }

  if (line.includes("10:10")) {
    return "2026-05-18T10:10:00.000Z";
  }

  if (line.includes("12:00")) {
    return "2026-05-18T12:00:00.000Z";
  }

  if (line.includes("12:20")) {
    return "2026-05-18T12:20:00.000Z";
  }

  if (line.includes("14:00")) {
    return "2026-05-18T14:00:00.000Z";
  }

  if (line.includes("16:00")) {
    return "2026-05-18T16:00:00.000Z";
  }

  if (line.includes("18:30")) {
    return "2026-05-18T18:30:00.000Z";
  }

  if (line.includes("20:30")) {
    return "2026-05-18T20:30:00.000Z";
  }

  if (line.includes("21:30")) {
    return "2026-05-18T21:30:00.000Z";
  }

  if (line.includes("体育课")) {
    return "2026-05-19T08:00:00.000Z";
  }

  if (line.includes("英语作文")) {
    return "2026-05-19T23:59:00.000Z";
  }

  if (line.includes("07:45")) {
    return "2026-05-19T07:45:00.000Z";
  }

  return "2026-05-18T22:00:00.000Z";
}

function queueKindForCard(card: ImportedTopLevelCard, hidden: boolean): QueueItem["kind"] {
  if (hidden) {
    return "hidden-goal";
  }

  if (card.kind === "course") {
    return "calendar-event";
  }

  if (card.kind === "reminder") {
    return "reminder";
  }

  return "card";
}

function cardToQueueItem(card: ImportedTopLevelCard, index: number, hidden: boolean): QueueItem {
  const scheduledAt = isoForCard(card);

  return {
    id: card.id,
    title: card.title,
    kind: queueKindForCard(card, hidden),
    status: hidden ? "hidden" : "queued",
    source: "mixed",
    createdAt: importedAt,
    estimatedMinutes: card.kind === "course" ? 15 : card.kind === "deadline" ? 25 : card.kind === "reminder" ? 5 : 20,
    deadlineAt: scheduledAt,
    suggestedStartAt: card.kind === "reminder" || card.kind === "course" || card.sourceLine.includes("牙医") ? scheduledAt : undefined,
    urgencyStage: index < 2 ? "hot" : card.kind === "deadline" ? "hot" : "warm",
    position: index,
    hidden,
    reminderSync: card.kind === "reminder" ? "wanted" : "none",
    calendarSync: card.kind === "course" ? "wanted" : "none",
    timeLocks: [],
    behaviorVector: {
      expectancy: card.kind === "task" ? 62 : 74,
      taskValue: card.kind === "deadline" ? 86 : card.kind === "course" ? 78 : 70,
      procrastination: hidden ? 58 : 36,
      timePressure: card.kind === "deadline" ? 86 : index < 2 ? 82 : 64,
      reasons: ["大型导入模拟中的后台排序项。"]
    }
  };
}

function hardLockFor(item: QueueItem): TimeLock {
  return {
    id: `hard-lock-${item.id}`,
    targetId: item.id,
    targetType: item.kind === "calendar-event" ? "calendar-event" : "card",
    kind: "user-fixed",
    strength: "hard",
    startsAt: item.suggestedStartAt ?? item.deadlineAt ?? importedAt,
    endsAt: "2026-05-18T19:00:00.000Z",
    lockedAt: "2026-05-18T06:50:00.000Z",
    reason: "用户固定在记事本/日历里的安排，调度 agent 不能静默移动。",
    canAgentMove: false,
    canAgentSuggest: true
  };
}

describe("usage simulation: large multi-goal import", () => {
  it("keeps review gate, coverage, hidden backlog, hard locks, and worker reveal/deal behavior stable", () => {
    const review = createImportReview({
      sourceType: "mixed",
      rawText: largeMultiGoalText
    });

    expect(review.reviewRequired).toBe(true);
    expect(review.userReviewPrompt).toContain("检阅");
    expect(review.topLevelCards).toHaveLength(12);
    expect(review.dealNowCards.length).toBeGreaterThanOrEqual(1);
    expect(review.dealNowCards.length).toBeLessThanOrEqual(2);
    expect(review.hiddenBacklogCards).toHaveLength(review.topLevelCards.length - review.dealNowCards.length);
    expect(review.hiddenBacklogCards.length).toBeGreaterThanOrEqual(10);

    expect(cardByFragment(review.topLevelCards, "课程群通知").kind).toBe("course");
    expect(cardByFragment(review.topLevelCards, "大学英语").kind).toBe("course");
    expect(cardByFragment(review.topLevelCards, "物理实验").kind).toBe("course");
    expect(cardByFragment(review.topLevelCards, "体育课").kind).toBe("course");
    expect(cardByFragment(review.topLevelCards, "计算机导论实验截图").kind).toBe("deadline");
    expect(cardByFragment(review.topLevelCards, "线代作业第一版").kind).toBe("deadline");
    expect(cardByFragment(review.topLevelCards, "英语作文").kind).toBe("deadline");
    expect(cardByFragment(review.topLevelCards, "给导师回复").kind).toBe("reminder");
    expect(cardByFragment(review.topLevelCards, "给妈妈打电话").kind).toBe("reminder");

    expect(review.coverageChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "timetable-line-count", passed: true }),
        expect.objectContaining({ kind: "deadline-count", passed: true }),
        expect.objectContaining({ kind: "reminder-count", passed: true })
      ])
    );

    const dealNowItems = review.dealNowCards.map((card, index) => cardToQueueItem(card, index, false));
    const hiddenBacklogItems = review.hiddenBacklogCards.map((card, index) =>
      cardToQueueItem(card, index + review.dealNowCards.length, true)
    );
    const allItems = [...dealNowItems, ...hiddenBacklogItems];
    const fixedDental = allItems.find((item) => item.title.includes("牙医"));

    expect(fixedDental).toBeDefined();

    const fixedDentalLock = hardLockFor(fixedDental as QueueItem);
    const initialSchedule = createSchedulePlan({
      now: importedAt,
      items: allItems,
      activeQueue: [],
      timeLocks: [fixedDentalLock],
      maxDealCards: 2
    });
    const initialDealActions = initialSchedule.actions.filter((action) => action.kind === "deal-card");

    expect(initialSchedule.lockedConflicts).toEqual([
      expect.objectContaining({
        targetId: fixedDental?.id,
        lockId: fixedDentalLock.id,
        suggestedAction: "suggest-only"
      })
    ]);
    expect(initialSchedule.actions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "move-task", targetId: fixedDental?.id })])
    );
    expect(initialDealActions).toHaveLength(review.dealNowCards.length);
    expect(initialDealActions.length).toBeLessThanOrEqual(2);
    expect(initialDealActions.map((action) => action.targetId)).toEqual(
      expect.arrayContaining(review.dealNowCards.map((card) => card.id))
    );
    expect(initialDealActions.map((action) => action.targetId)).not.toEqual(
      expect.arrayContaining(review.hiddenBacklogCards.map((card) => card.id))
    );

    const worker = runBackendWorkerTick({
      now: "2026-05-18T19:45:00.000Z",
      queueItems: dealNowItems,
      activeQueue: dealNowItems.map((item) => item.id),
      timeLocks: [fixedDentalLock],
      frozenTasks: [],
      hiddenGoals: hiddenBacklogItems,
      processedActionIds: initialSchedule.actions.map((action) => action.id)
    });
    const workerDealActions = worker.actions.filter((action) => action.kind === "deal-card");
    const workerRevealActions = worker.actions.filter((action) => action.kind === "reveal-hidden-goal");

    expect(worker.schedule.lockedConflicts).toEqual([
      expect.objectContaining({ targetId: fixedDental?.id, suggestedAction: "suggest-only" })
    ]);
    expect(worker.actions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "move-task", targetId: fixedDental?.id })])
    );
    expect(workerRevealActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: expect.stringMatching(/^import-card-/),
          requiresUserReview: true,
          respectsLocks: true
        })
      ])
    );
    expect(workerDealActions.length).toBeLessThanOrEqual(2);
    expect(workerDealActions.map((action) => action.targetId)).not.toEqual(
      expect.arrayContaining(hiddenBacklogItems.map((item) => item.id))
    );

    const repeatedWorker = runBackendWorkerTick({
      now: "2026-05-18T19:45:00.000Z",
      queueItems: dealNowItems,
      activeQueue: dealNowItems.map((item) => item.id),
      timeLocks: [fixedDentalLock],
      frozenTasks: [],
      hiddenGoals: hiddenBacklogItems,
      processedActionIds: [...initialSchedule.actions, ...worker.actions].map((action) => action.id)
    });

    expect(repeatedWorker.actions).toHaveLength(0);
  });
});

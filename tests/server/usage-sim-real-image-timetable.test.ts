import { describe, expect, it } from "vitest";
import { runBackendWorkerTick } from "@/lib/server/backend-worker";
import { createImportReview } from "@/lib/server/import-coverage";
import { createSchedulePlan } from "@/lib/server/schedule-planner";
import type { ImportedTopLevelCard, QueueItem } from "@/lib/types";

const realTimetableExtraction = [
  "第11周，2025-2026 第2学期，5月11日 周一 第1节 08:00-09:35 大学物理B（上）",
  "第11周，2025-2026 第2学期，5月11日 周一 第2节 10:05-11:40 高等数学B@西3-T1",
  "第11周，2025-2026 第2学期，5月11日 周一 第3节 14:00-15:35 思想道德与法治@西",
  "第11周，2025-2026 第2学期，5月12日 周二 第2节 10:05-11:40 综合英语（发展）",
  "第11周，2025-2026 第2学期，5月13日 周三 第2节 10:05-11:40 大学物理B（上）",
  "第11周，2025-2026 第2学期，5月13日 周三 第3节 14:00-15:35 思想道德与法治@西",
  "第11周，2025-2026 第2学期，5月14日 周四 第1节 08:00-09:35 综合英语（发展）",
  "第11周，2025-2026 第2学期，5月14日 周四 第2节 10:05-11:40 体育（篮球-）",
  "第11周，2025-2026 第2学期，5月14日 周四 第6节 19:50-21:25 形势与政策2@西",
  "第11周，2025-2026 第2学期，5月15日 周五 第1节 08:00-09:35 高等数学B@西3-T1",
  "非本周，5月16日 周六 第4节 16:05-17:40 学科前沿讲"
].join("\n");

function isoForCard(card: ImportedTopLevelCard) {
  const day = card.sourceLine.match(/5月(\d{1,2})日/)?.[1] ?? "11";
  const time = card.sourceLine.match(/(\d{1,2}:\d{2})/)?.[1] ?? "08:00";

  return `2026-05-${day.padStart(2, "0")}T${time}:00.000Z`;
}

function cardToQueueItem(card: ImportedTopLevelCard, index: number, hidden: boolean): QueueItem {
  const scheduledAt = isoForCard(card);

  return {
    id: card.id,
    title: card.title,
    kind: hidden ? "hidden-goal" : "calendar-event",
    status: hidden ? "hidden" : "queued",
    source: "image",
    createdAt: "2026-05-11T07:20:00.000Z",
    estimatedMinutes: 15,
    deadlineAt: scheduledAt,
    suggestedStartAt: scheduledAt,
    urgencyStage: index < 2 ? "hot" : "warm",
    position: index,
    hidden,
    calendarSync: hidden ? "none" : "wanted",
    reminderSync: "none",
    timeLocks: []
  };
}

describe("usage simulation: real image timetable import", () => {
  it("keeps all visible timetable blocks as course cards without cross-day false conflicts", () => {
    const review = createImportReview({
      sourceType: "image",
      rawText: realTimetableExtraction
    });

    expect(review.reviewRequired).toBe(true);
    expect(review.topLevelCards).toHaveLength(11);
    expect(review.topLevelCards.map((card) => card.kind)).toEqual(Array.from({ length: 11 }, () => "course"));
    expect(review.dealNowCards).toHaveLength(2);
    expect(review.hiddenBacklogCards).toHaveLength(9);
    expect(review.conflicts).toHaveLength(0);
    expect(review.coverageChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "timetable-line-count",
          passed: true,
          detail: "识别 11 个顶层项目 / 11 行输入。"
        }),
        expect.objectContaining({ kind: "conflict-scan", passed: true })
      ])
    );
    expect(review.topLevelCards.map((card) => card.timeLabel)).toEqual([
      "5月11日 周一 第1节 08:00",
      "5月11日 周一 第2节 10:05",
      "5月11日 周一 第3节 14:00",
      "5月12日 周二 第2节 10:05",
      "5月13日 周三 第2节 10:05",
      "5月13日 周三 第3节 14:00",
      "5月14日 周四 第1节 08:00",
      "5月14日 周四 第2节 10:05",
      "5月14日 周四 第6节 19:50",
      "5月15日 周五 第1节 08:00",
      "5月16日 周六 第4节 16:05"
    ]);
  });

  it("throttles hidden timetable reveals so a large course import does not flood review", () => {
    const review = createImportReview({
      sourceType: "image",
      rawText: realTimetableExtraction
    });
    const dealNowItems = review.dealNowCards.map((card, index) => cardToQueueItem(card, index, false));
    const hiddenBacklogItems = review.hiddenBacklogCards.map((card, index) =>
      cardToQueueItem(card, index + review.dealNowCards.length, true)
    );

    const initialSchedule = createSchedulePlan({
      now: "2026-05-11T07:20:00.000Z",
      items: [...dealNowItems, ...hiddenBacklogItems],
      activeQueue: [],
      timeLocks: [],
      maxDealCards: 2
    });
    const laterWorker = runBackendWorkerTick({
      now: "2026-05-14T19:10:00.000Z",
      queueItems: dealNowItems,
      activeQueue: dealNowItems.map((item) => item.id),
      timeLocks: [],
      frozenTasks: [],
      hiddenGoals: hiddenBacklogItems,
      processedActionIds: initialSchedule.actions.map((action) => action.id)
    });

    expect(initialSchedule.actions.filter((action) => action.kind === "reveal-hidden-goal").length).toBeLessThanOrEqual(2);
    expect(laterWorker.actions.filter((action) => action.kind === "reveal-hidden-goal").length).toBeLessThanOrEqual(2);
  });
});

import { describe, expect, it } from "vitest";
import { POST as importReviewPost } from "@/app/api/backend/import/review/route";
import { createSchedulePlan } from "@/lib/server/schedule-planner";
import { runBackendWorkerTick } from "@/lib/server/backend-worker";
import type { ImportedTopLevelCard, QueueItem } from "@/lib/types";

const importedAt = "2026-05-20T07:30:00.000Z";
const reviewText = [
  "图片时间表：周三 08:10 高数课 二教304，课前准备教材和上次作业页",
  "周三 10:00 大学英语 三教201，带听力材料",
  "周三 14:00 物理实验 实验楼B201，提前 10 分钟到",
  "周三 20:30 课程报告截止，提交 PDF 和截图",
  "提醒：周三 07:50 出门前检查校园卡、教材、实验服"
].join("\n");

function request(body: unknown) {
  return new Request("http://next-card.test/api/backend/import/review", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" }
  });
}

function expectNoOcrTerms(payload: unknown) {
  const text = JSON.stringify(payload).toLowerCase();

  expect(text).not.toMatch(/\bocr\b/);
  expect(text).not.toContain("光学字符识别");
}

function cardToQueueItem(card: ImportedTopLevelCard, index: number, hidden: boolean): QueueItem {
  const deadlineByKind: Record<ImportedTopLevelCard["kind"], string> = {
    course: index === 0 ? "2026-05-20T08:10:00.000Z" : index === 1 ? "2026-05-20T10:00:00.000Z" : "2026-05-20T14:00:00.000Z",
    deadline: "2026-05-20T20:30:00.000Z",
    reminder: "2026-05-20T07:50:00.000Z",
    task: "2026-05-20T12:00:00.000Z"
  };

  return {
    id: card.id,
    title: card.title,
    kind: hidden ? "hidden-goal" : card.kind === "course" ? "calendar-event" : "card",
    status: hidden ? "hidden" : "queued",
    source: "image",
    createdAt: importedAt,
    estimatedMinutes: card.kind === "course" ? 15 : 10,
    deadlineAt: deadlineByKind[card.kind],
    suggestedStartAt: card.kind === "reminder" ? "2026-05-20T07:50:00.000Z" : undefined,
    urgencyStage: index === 0 || card.kind === "reminder" ? "hot" : "warm",
    position: index,
    hidden,
    reminderSync: card.kind === "reminder" ? "wanted" : "none",
    calendarSync: card.kind === "course" ? "wanted" : "none",
    timeLocks: []
  };
}

describe("usage simulation: course timetable import review to hidden backlog", () => {
  it("reviews a future course timetable, deals only 1-2 cards, stores the rest hidden, then reveals or deals via backend scheduling", async () => {
    const response = await importReviewPost(
      request({
        sourceType: "image",
        rawText: reviewText,
        attachmentName: "future-course-table.png"
      })
    );
    const review = await response.json();

    expect(response.status).toBe(200);
    expect(review.reviewRequired).toBe(true);
    expect(review.topLevelCards.map((card: ImportedTopLevelCard) => card.kind)).toEqual([
      "course",
      "course",
      "course",
      "deadline",
      "reminder"
    ]);
    expect(review.topLevelCards.map((card: ImportedTopLevelCard) => card.sourceLine).join("\n")).toContain("课程报告截止");
    expect(review.topLevelCards.map((card: ImportedTopLevelCard) => card.sourceLine).join("\n")).toContain("出门前检查");
    expect(review.dealNowCards.length).toBeLessThanOrEqual(2);
    expect(review.hiddenBacklogCards).toHaveLength(review.topLevelCards.length - review.dealNowCards.length);
    expectNoOcrTerms(review);

    const dealNowItems = review.dealNowCards.map((card: ImportedTopLevelCard, index: number) =>
      cardToQueueItem(card, index, false)
    );
    const hiddenBacklogItems = review.hiddenBacklogCards.map((card: ImportedTopLevelCard, index: number) =>
      cardToQueueItem(card, index + review.dealNowCards.length, true)
    );

    const initialSchedule = createSchedulePlan({
      now: importedAt,
      items: [...dealNowItems, ...hiddenBacklogItems],
      activeQueue: [],
      timeLocks: [],
      maxDealCards: 2
    });
    const initialDealActions = initialSchedule.actions.filter((action) => action.kind === "deal-card");

    expect(initialDealActions).toHaveLength(review.dealNowCards.length);
    expect(initialDealActions.length).toBeLessThanOrEqual(2);
    expect(initialDealActions.map((action) => action.targetId)).toEqual(
      expect.arrayContaining(review.dealNowCards.map((card: ImportedTopLevelCard) => card.id))
    );
    expect(initialSchedule.actions.filter((action) => action.kind === "deal-card")).not.toEqual(
      expect.arrayContaining(
        review.hiddenBacklogCards.map((card: ImportedTopLevelCard) => expect.objectContaining({ targetId: card.id }))
      )
    );

    const laterWorker = runBackendWorkerTick({
      now: "2026-05-20T19:45:00.000Z",
      queueItems: dealNowItems,
      activeQueue: dealNowItems.map((item) => item.id),
      timeLocks: [],
      frozenTasks: [],
      hiddenGoals: hiddenBacklogItems,
      processedActionIds: initialSchedule.actions.map((action) => action.id)
    });
    const visibleActions = laterWorker.actions.filter((action) =>
      ["reveal-hidden-goal", "deal-card"].includes(action.kind)
    );

    expect(visibleActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "reveal-hidden-goal",
          targetId: expect.stringMatching(/import-card-[3-5]/),
          requiresUserReview: true
        })
      ])
    );
    expect(laterWorker.actions.filter((action) => action.kind === "deal-card").length).toBeLessThanOrEqual(2);
    expectNoOcrTerms(laterWorker);
  });
});

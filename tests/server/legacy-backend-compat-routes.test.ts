import { describe, expect, it } from "vitest";
import { POST as scheduleCompatPost } from "@/app/api/agent/schedule/route";
import { POST as clarifyCompatPost } from "@/app/api/ai/clarify/route";
import { POST as parseCompatPost } from "@/app/api/ai/parse/route";
import { POST as planCompatPost } from "@/app/api/ai/plan/route";
import { createFreezeReminderAction, validateScheduleAction } from "@/lib/server/schedule-agent";
import type { InputsState, TaskCard, TaskDeck } from "@/lib/types";

const inputs: InputsState = {
  text: "去高数课",
  attachments: [],
  imageSchedule: null,
  parsedText: "",
  sourceType: "text"
};

const deck: TaskDeck = {
  id: "deck-1",
  coverTitle: "去高数课",
  coverIcon: "course",
  agentId: "balanced-coach",
  agentName: "平衡教练",
  deckStatus: "active",
  cards: [],
  totalCards: 1,
  completedCards: 0
};

const card: TaskCard = {
  id: "card-1",
  deckId: "deck-1",
  agentId: "gentle-recovery",
  agentName: "温和恢复师",
  flowNodeId: "flow-1",
  title: "确认高数课时间和教室",
  action: "打开来源信息，圈出时间和地点。",
  estimatedMinutes: 4,
  deadlineAt: "2026-05-19T00:00:00.000Z",
  suggestedStartAt: "2026-05-18T23:40:00.000Z",
  startedAt: null,
  elapsedSeconds: 0,
  remainingSeconds: 1200,
  urgencyStage: "hot",
  damageEffect: "freeze",
  damageProgress: 0,
  burnLevel: 0,
  status: "frozen",
  encouragement: "先保存上下文。",
  cardBackNote: "稍后恢复。"
};

function request(body: unknown, url = "http://next-card.test/api/compat") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("legacy backend compatibility routes", () => {
  it("keeps /api/ai/plan as a thin wrapper over the target backend planner", async () => {
    await expect(planCompatPost(request({})).then((response) => response.status)).resolves.toBe(400);

    const response = await planCompatPost(request({ inputs }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      provider: expect.stringMatching(/mimo|mock/),
      analysis: expect.objectContaining({ goalUnderstanding: expect.stringContaining("高数") }),
      planMode: expect.objectContaining({ status: expect.stringMatching(/ready-to-build|needs-supplement|needs-review/) })
    });
    expect(body.options).toHaveLength(3);
    expect(body.taskFlow.nodes.length).toBeGreaterThan(0);
    expect(body.deck.cards.length).toBeGreaterThan(0);
  });

  it("keeps /api/ai/clarify capped and Plan Mode shaped without chatbot drift", async () => {
    await expect(clarifyCompatPost(request({ inputs })).then((response) => response.status)).resolves.toBe(400);

    const messages = Array.from({ length: 21 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `第 ${index + 1} 条上下文：周一 08:00 高数课`
    }));
    const response = await clarifyCompatPost(request({ inputs, messages }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(body.shouldPlan).toBe(true);
    expect(body.messages).toHaveLength(20);
    expect(body.maxRounds).toBe(10);
    expect(body.planMode.shouldBuildNow).toBe(true);
  });

  it("maps /api/ai/parse to import review plus parsed text hints", async () => {
    await expect(parseCompatPost(request({ kind: "image" })).then((response) => response.status)).resolves.toBe(400);

    const response = await parseCompatPost(
      request({
        kind: "attachment",
        name: "notice.txt",
        text: "明天 08:00 高数课在二教304。\n今晚 20:00 前提交一页课程分析。"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sourceType).toBe("attachment");
    expect(body.parsedText).toContain("高数");
    expect(body.timeHints).toEqual(expect.arrayContaining(["明天 08:00", "今晚 20:00 前"]));
    expect(body.review.topLevelCards.length).toBeGreaterThanOrEqual(2);
  });

  it("validates /api/agent/schedule and exposes a QueueAction bridge", async () => {
    const action = createFreezeReminderAction({ card, deck, now: "2026-05-17T20:00:00.000Z" });

    expect(validateScheduleAction(action).ok).toBe(true);
    await expect(scheduleCompatPost(request({ kind: "create-reminder" })).then((response) => response.status)).resolves.toBe(422);

    const response = await scheduleCompatPost(request(action));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.validation.ok).toBe(true);
    expect(body.queueAction).toMatchObject({
      kind: "create-reminder",
      targetId: "card-1",
      scheduledFor: "2026-05-18T23:40:00.000Z",
      respectsLocks: true
    });
  });
});

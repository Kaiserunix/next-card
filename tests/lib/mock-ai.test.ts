import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAnalyzeInput,
  mockGenerateDeckFromPlan,
  mockGeneratePlanOptions,
  mockGenerateProofSummary,
  mockGenerateTaskFlow,
  mockGenerateTimePlanForCard,
  mockRegeneratePlanOptions,
  mockRescheduleFrozenCard,
  mockUpdateCardUrgency
} from "@/lib/mock-ai";
import type { InputsState, PlanOption, ProofRecord, TaskCard } from "@/lib/types";

const baseNow = new Date("2026-05-16T08:00:00.000Z");

function makeInput(overrides: Partial<InputsState> = {}): InputsState {
  return {
    text: "",
    attachments: [],
    imageSchedule: null,
    parsedText: "",
    sourceType: "text",
    ...overrides
  };
}

function addMinutes(minutes: number) {
  return new Date(baseNow.getTime() + minutes * 60_000).toISOString();
}

function makeCoursePlan(): PlanOption {
  const analysis = mockAnalyzeInput(makeInput({ text: "去高数课" }));
  return mockGeneratePlanOptions(analysis)[0];
}

function makeCourseDeck() {
  const plan = makeCoursePlan();
  const flow = mockGenerateTaskFlow(plan);
  return {
    deck: mockGenerateDeckFromPlan(plan, flow, "去高数课"),
    flow,
    plan
  };
}

describe("mockAnalyzeInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
  });

  it("uses a gentle default goal and time suggestion when input is empty", () => {
    const analysis = mockAnalyzeInput(makeInput());

    expect(analysis.sourceType).toBe("text");
    expect(analysis.goalUnderstanding).toContain("整理今天最需要推进的一件事");
    expect(analysis.constraints).toContain("输入里没有明确截止时间，使用温和默认时间建议");
    expect(analysis.deadlineLabel).toBe("今天内完成第一轮推进");
    expect(analysis.suggestedStart).toBe("25 分钟内开始");
  });

  it("keeps long goals readable in the understanding text", () => {
    const analysis = mockAnalyzeInput(
      makeInput({ text: "这是一段很长很长的课程作业说明，需要先整理输入，再拆解行动，最后留下证明记录" })
    );

    expect(analysis.goalUnderstanding).toContain("这是一段很长很长的课程作业说明");
    expect(analysis.goalUnderstanding).toContain("...");
  });

  it("classifies attachment-only input as attachment source", () => {
    const analysis = mockAnalyzeInput(
      makeInput({
        attachments: [{ id: "a-1", name: "notice.txt", kind: "notice", mockedText: "今晚提交作业" }],
        parsedText: "今晚 20:00 前提交作业"
      })
    );

    expect(analysis.sourceType).toBe("attachment");
    expect(analysis.goalUnderstanding).toContain("最低可提交");
  });

  it("classifies image timetable-only input as image source and course intent", () => {
    const analysis = mockAnalyzeInput(
      makeInput({
        imageSchedule: {
          id: "img-1",
          name: "schedule.png",
          parsedTimetable: "图像识别：明天 08:00 高数课，地点二教 304"
        }
      })
    );

    expect(analysis.sourceType).toBe("image");
    expect(analysis.goalUnderstanding).toContain("出门/到课卡组");
    expect(analysis.availableWindow).toBe("现在到课前 20 分钟");
  });

  it("classifies text plus attachment or image as mixed source", () => {
    const analysis = mockAnalyzeInput(
      makeInput({
        text: "帮我处理这份通知",
        attachments: [{ id: "a-1", name: "notice.txt", kind: "notice", mockedText: "今晚提交作业" }],
        parsedText: "今晚 20:00 前提交作业"
      })
    );

    expect(analysis.sourceType).toBe("mixed");
    expect(analysis.deadlineLabel).toBe("今晚 20:00 前");
  });

  it("extracts course constraints and stages from a one-sentence course goal", () => {
    const analysis = mockAnalyzeInput(makeInput({ text: "去高数课" }));

    expect(analysis.goalUnderstanding).toContain("去高数课");
    expect(analysis.constraints).toEqual(
      expect.arrayContaining([
        "课程开始前需要留出整理物品和路上缓冲",
        "第一张卡适合做成近截止燃烧演示，帮助快速启动"
      ])
    );
    expect(analysis.stages).toEqual(["确认课程信息", "整理材料", "出门移动", "到达后课前准备"]);
    expect(analysis.deadlineLabel).toContain("最佳出门窗口");
  });

  it("extracts assignment strategy from deadline-like text", () => {
    const analysis = mockAnalyzeInput(makeInput({ text: "今晚 20:00 前交一页课程分析作业" }));

    expect(analysis.goalUnderstanding).toContain("最低可提交");
    expect(analysis.deadlineLabel).toContain("今晚 20:00 前");
    expect(analysis.stages).toEqual(["读要求", "做最低可交版本", "补充关键细节", "提交前检查"]);
    expect(analysis.timeStrategy).toContain("截止前 10 分钟自动提高到 hot / burning");
  });

  it("classifies plain homework wording as an assignment contract", () => {
    const analysis = mockAnalyzeInput(makeInput({ text: "写高数作业" }));

    expect(analysis.goalUnderstanding).toContain("最低可提交");
    expect(analysis.deadlineLabel).toBe("今晚 20:00 前");
  });
});

describe("mockGeneratePlanOptions and regeneration", () => {
  it("returns exactly the three required plan choices in the required order", () => {
    const options = mockGeneratePlanOptions(mockAnalyzeInput(makeInput({ text: "整理课程作业" })));

    expect(options).toHaveLength(3);
    expect(options.map((option) => option.id)).toEqual(["plan-1", "plan-2", "plan-3"]);
    expect(options.map((option) => option.name)).toEqual(["方案一", "方案二", "方案三"]);
    expect(options.map((option) => option.style)).toEqual(["urgent", "balanced", "gentle"]);
    expect(options.map((option) => option.detailLevel)).toEqual(["high", "medium", "low"]);
  });

  it("generates course-specific actions for a course analysis", () => {
    const options = mockGeneratePlanOptions(mockAnalyzeInput(makeInput({ text: "去高数课" })));

    expect(options[0].estimatedTime).toBe("18 min");
    expect(options[0].steps).toContain("把教材、笔、上次作业页放进包里");
    expect(options[1].steps).toContain("课前 3 分钟复盘上次内容");
    expect(options[2].summary).toContain("低压力版本");
  });

  it("generates minimum-submission actions for assignment analysis", () => {
    const options = mockGeneratePlanOptions(mockAnalyzeInput(makeInput({ text: "ddl 前提交课程报告" })));

    expect(options[0].steps).toContain("用 10 分钟做最低可交版本");
    expect(options[1].steps).toContain("检查格式和遗漏");
    expect(options[2].steps).toContain("留下下一次继续的上下文");
  });

  it("regenerates plans while preserving ids and adding refreshed guidance", () => {
    const input = makeInput({ text: "去高数课" });
    const previous = mockGeneratePlanOptions(mockAnalyzeInput(input));
    const refreshed = mockRegeneratePlanOptions(input, previous);

    expect(refreshed).toHaveLength(3);
    expect(refreshed.map((option) => option.id)).toEqual(previous.map((option) => option.id));
    expect(refreshed[0].estimatedTime).toBe("15 min");
    expect(refreshed[0].summary).toContain("这次重新生成会偏向更短启动");
    expect(refreshed.every((option) => option.steps[0].endsWith("并写下下一步"))).toBe(true);
  });
});

describe("mockGenerateTaskFlow", () => {
  it("builds a lightweight four-node flow with three edges", () => {
    const flow = mockGenerateTaskFlow(makeCoursePlan());

    expect(flow.title).toBe("方案一任务流");
    expect(flow.overallProgress).toBe(0);
    expect(flow.nodes).toHaveLength(4);
    expect(flow.edges).toEqual([
      { from: "flow-plan-1-1", to: "flow-plan-1-2" },
      { from: "flow-plan-1-2", to: "flow-plan-1-3" },
      { from: "flow-plan-1-3", to: "flow-plan-1-4" }
    ]);
  });

  it("marks the first node active and labels urgent pressure", () => {
    const flow = mockGenerateTaskFlow(makeCoursePlan());

    expect(flow.nodes[0]).toMatchObject({
      status: "active",
      progress: 12,
      timeLabel: "还有 18 分钟",
      urgencyStage: "hot"
    });
    expect(flow.nodes[2].timeLabel).toBe("最后窗口");
  });

  it("marks a gentle plan's final node as frozen candidate", () => {
    const gentlePlan = mockGeneratePlanOptions(mockAnalyzeInput(makeInput({ text: "整理周计划" })))[2];
    const flow = mockGenerateTaskFlow(gentlePlan);

    expect(flow.nodes[3].status).toBe("frozen");
    expect(flow.nodes[0].urgencyStage).toBe("calm");
  });
});

describe("mockGenerateDeckFromPlan", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
  });

  it("creates the required course deck identity for 去高数课", () => {
    const { deck } = makeCourseDeck();

    expect(deck.coverTitle).toBe("去高数课");
    expect(deck.coverIcon).toBe("course");
    expect(deck.deckStatus).toBe("new");
    expect(deck.totalCards).toBe(deck.cards.length);
    expect(deck.cards.every((card) => card.deckId === deck.id)).toBe(true);
  });

  it("supports the two-argument contract and derives course deck identity from the selected plan", () => {
    const plan = makeCoursePlan();
    const flow = mockGenerateTaskFlow(plan);
    const deck = mockGenerateDeckFromPlan(plan, flow);

    expect(deck.coverTitle).toBe("去高数课");
    expect(deck.coverIcon).toBe("course");
    expect(deck.cards[0].title).toBe("确认高数课时间和教室");
  });

  it("creates a near-deadline burning demo as the first course card", () => {
    const { deck } = makeCourseDeck();
    const first = deck.cards[0];

    expect(first.title).toBe("确认高数课时间和教室");
    expect(first.status).toBe("active");
    expect(first.estimatedMinutes).toBe(4);
    expect(first.urgencyStage).toBe("burning");
    expect(first.damageEffect).toBe("burn");
    expect(first.burnLevel).toBe(3);
    expect(first.remainingSeconds).toBe(480);
    expect(first.deadlineAt).toBe(addMinutes(8));
  });

  it("keeps every generated card as a concrete action task", () => {
    const { deck } = makeCourseDeck();
    const broadTasks = ["学习数学", "完成作业", "背单词"];

    expect(deck.cards.length).toBeGreaterThanOrEqual(4);
    expect(deck.cards.length).toBeLessThanOrEqual(6);
    for (const card of deck.cards) {
      expect(card.action.length).toBeGreaterThan(10);
      expect(broadTasks).not.toContain(card.title);
      expect(card.flowNodeId).toMatch(/^flow-plan-1-/);
      expect(card.encouragement).not.toHaveLength(0);
      expect(card.cardBackNote).not.toHaveLength(0);
    }
  });

  it("creates a spark deck and a queued second card for non-course goals", () => {
    const analysis = mockAnalyzeInput(makeInput({ text: "今晚提交课程报告作业" }));
    const plan = mockGeneratePlanOptions(analysis)[0];
    const flow = mockGenerateTaskFlow(plan);
    const deck = mockGenerateDeckFromPlan(plan, flow, "今晚提交课程报告作业");

    expect(deck.coverIcon).toBe("spark");
    expect(deck.cards[0].status).toBe("active");
    expect(deck.cards[1]).toMatchObject({
      title: "写下最低可完成版本的边界",
      status: "queued",
      urgencyStage: "warm"
    });
  });
});

describe("card time helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
  });

  function cardWithDeadline(minutes: number | null): TaskCard {
    const { deck } = makeCourseDeck();
    return {
      ...deck.cards[0],
      deadlineAt: minutes === null ? null : addMinutes(minutes),
      damageEffect: "none",
      damageProgress: 0,
      burnLevel: 0,
      urgencyStage: "calm",
      remainingSeconds: null
    };
  }

  it("formats deadline-backed cards with remaining minutes", () => {
    const plan = mockGenerateTimePlanForCard(cardWithDeadline(14));

    expect(plan.windowLabel).toBe("剩 14 min");
    expect(plan.urgencyStage).toBe("calm");
  });

  it("formats cards without deadlines with a gentle start suggestion", () => {
    const card = { ...cardWithDeadline(null), suggestedStartAt: addMinutes(5) };
    const plan = mockGenerateTimePlanForCard(card);

    expect(plan.windowLabel).toBe("建议现在开始");
  });

  it("marks expired cards with crack damage and no remaining seconds", () => {
    const updated = mockUpdateCardUrgency(cardWithDeadline(-1), baseNow);

    expect(updated).toMatchObject({
      urgencyStage: "expired",
      damageEffect: "crack",
      burnLevel: 0,
      remainingSeconds: 0,
      damageProgress: 100
    });
  });

  it("marks the final three minutes as burning", () => {
    const updated = mockUpdateCardUrgency(cardWithDeadline(3), baseNow);

    expect(updated).toMatchObject({
      urgencyStage: "burning",
      damageEffect: "burn",
      burnLevel: 3,
      remainingSeconds: 180,
      damageProgress: 86
    });
  });

  it("marks the twenty-minute pressure window as hot", () => {
    const updated = mockUpdateCardUrgency(cardWithDeadline(20), baseNow);

    expect(updated).toMatchObject({
      urgencyStage: "hot",
      damageEffect: "burn",
      burnLevel: 2,
      remainingSeconds: 1200,
      damageProgress: 52
    });
  });

  it("keeps cards calm when the deadline is more than twenty minutes away", () => {
    const updated = mockUpdateCardUrgency(cardWithDeadline(21), baseNow);

    expect(updated.urgencyStage).toBe("calm");
    expect(updated.damageEffect).toBe("none");
    expect(updated.remainingSeconds).toBe(1260);
  });

  it("does not modify cards without a deadline", () => {
    const card = cardWithDeadline(null);

    expect(mockUpdateCardUrgency(card, baseNow)).toBe(card);
  });

  it("reschedules frozen cards with freeze priority and a future start time", () => {
    const { deck, flow } = makeCourseDeck();
    const frozen = mockRescheduleFrozenCard(deck.cards[0], flow);

    expect(frozen.status).toBe("frozen");
    expect(frozen.damageEffect).toBe("freeze");
    expect(frozen.urgencyStage).toBe("calm");
    expect(frozen.burnLevel).toBe(0);
    expect(new Date(frozen.suggestedStartAt ?? "").getTime()).toBeGreaterThan(baseNow.getTime());
    expect(frozen.cardBackNote).toContain(flow.title);
    expect(frozen.cardBackNote).toContain("稍后恢复上下文");
  });
});

describe("mockGenerateProofSummary", () => {
  it("returns an empty-state document before any proof exists", () => {
    expect(mockGenerateProofSummary([])).toContain("还没有形成证明记录");
  });

  it("summarizes completed, frozen, and burning evidence counts", () => {
    const records: ProofRecord[] = [
      makeProof("completed", "on-time"),
      makeProof("rewarded", "burning-completed"),
      makeProof("frozen", "frozen-rescheduled")
    ];

    const summary = mockGenerateProofSummary(records);

    expect(summary).toContain("3 条行动证据");
    expect(summary).toContain("2 个目标进入完成或奖励状态");
    expect(summary).toContain("1 张卡片被温柔冻结");
    expect(summary).toContain("1 张卡片上使用了燃烧节奏");
  });
});

function makeProof(status: ProofRecord["status"], timeStatus: ProofRecord["timeStatus"]): ProofRecord {
  return {
    id: `proof-${status}`,
    goalTitle: "去高数课",
    source: "text",
    status,
    progress: status === "frozen" ? 50 : 100,
    completedCards: status === "frozen" ? 1 : 4,
    frozenCards: status === "frozen" ? 1 : 0,
    actualMinutes: 8,
    timeStatus,
    timeDamageEvents: ["测试事件"],
    lastAction: "测试行动",
    nextSuggestion: "继续下一张卡",
    createdAt: baseNow.toISOString()
  };
}

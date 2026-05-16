import { describe, it, expect } from "vitest";
import {
  mockAnalyzeInput,
  mockGeneratePlanOptions,
  mockRegeneratePlanOptions,
  mockGenerateTaskFlow,
  mockGenerateDeckFromPlan,
  mockGenerateTimePlanForCard,
  mockUpdateCardUrgency,
  mockRescheduleFrozenCard,
  mockGenerateProofSummary,
} from "@/lib/mock-ai";
import type { InputsState, ProofRecord, TaskCard } from "@/lib/types";

const blankInputs = (overrides: Partial<InputsState> = {}): InputsState => ({
  text: "",
  attachments: [],
  imageSchedule: null,
  parsedText: "",
  sourceType: "text",
  ...overrides,
});

const baseCard = (overrides: Partial<TaskCard> = {}): TaskCard => ({
  id: "card-1",
  deckId: "deck-1",
  flowNodeId: "flow-1",
  title: "测试",
  action: "测试动作",
  estimatedMinutes: 10,
  deadlineAt: null,
  suggestedStartAt: null,
  startedAt: null,
  elapsedSeconds: 0,
  remainingSeconds: null,
  urgencyStage: "calm",
  damageEffect: "none",
  damageProgress: 0,
  burnLevel: 0,
  status: "queued",
  encouragement: "",
  cardBackNote: "",
  ...overrides,
});

describe("mockAnalyzeInput - course track (去高数课)", () => {
  it("recognizes course intent and emits non-empty contract fields", () => {
    const result = mockAnalyzeInput(blankInputs({ text: "去高数课" }));
    expect(result.goalUnderstanding).toContain("去高数课");
    expect(result.constraints.length).toBeGreaterThan(0);
    expect(result.timeStrategy.length).toBeGreaterThan(0);
    expect(result.deadlineLabel).toBeTruthy();
    expect(result.availableWindow).toBeTruthy();
    expect(result.suggestedStart).toBeTruthy();
  });

  it("course window mentions 出门 / 课前 / 准备", () => {
    const result = mockAnalyzeInput(blankInputs({ text: "去高数课" }));
    const blob = `${result.goalUnderstanding}${result.constraints.join("")}${result.timeStrategy.join("")}`;
    expect(/出门|课前|准备|到课/.test(blob)).toBe(true);
  });
});

describe("mockAnalyzeInput - assignment track", () => {
  it("recognizes assignment text and uses 今晚 20:00 deadline copy", () => {
    const result = mockAnalyzeInput(blankInputs({ text: "今晚 20:00 前交一页分析作业" }));
    expect(result.deadlineLabel).toContain("20:00");
  });

  it("constraints mention 最低可交版本 protection", () => {
    const result = mockAnalyzeInput(blankInputs({ text: "作业 ddl 今晚提交" }));
    const blob = result.constraints.join("");
    expect(/可交|最低/.test(blob)).toBe(true);
  });
});

describe("mockAnalyzeInput - default track (no explicit time)", () => {
  it("never returns empty time anchors", () => {
    const result = mockAnalyzeInput(blankInputs({ text: "整理一下今天的笔记" }));
    expect(result.deadlineLabel.length).toBeGreaterThan(0);
    expect(result.availableWindow.length).toBeGreaterThan(0);
    expect(result.suggestedStart.length).toBeGreaterThan(0);
  });

  it("falls back to gentle default time copy", () => {
    const result = mockAnalyzeInput(blankInputs({ text: "整理一下今天的笔记" }));
    const blob = `${result.deadlineLabel}${result.availableWindow}${result.suggestedStart}`;
    expect(/今天|分钟/.test(blob)).toBe(true);
  });
});

describe("mockGeneratePlanOptions - 3-plan contract", () => {
  it("returns exactly 3 plans with ids plan-1/2/3 and styles urgent/balanced/gentle", () => {
    const analysis = mockAnalyzeInput(blankInputs({ text: "去高数课" }));
    const options = mockGeneratePlanOptions(analysis);
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.id)).toEqual(["plan-1", "plan-2", "plan-3"]);
    expect(options.map((o) => o.style)).toEqual(["urgent", "balanced", "gentle"]);
  });

  it("each plan has 4 steps and a non-empty estimatedTime", () => {
    const analysis = mockAnalyzeInput(blankInputs({ text: "今晚交作业" }));
    const options = mockGeneratePlanOptions(analysis);
    options.forEach((opt) => {
      expect(opt.steps.length).toBe(4);
      expect(opt.estimatedTime).toBeTruthy();
      expect(opt.summary).toBeTruthy();
    });
  });
});

describe("mockRegeneratePlanOptions", () => {
  it("preserves intent: returns 3 plans with same ids and styles", () => {
    const inputs = blankInputs({ text: "去高数课" });
    const previous = mockGeneratePlanOptions(mockAnalyzeInput(inputs));
    const next = mockRegeneratePlanOptions(inputs, previous);
    expect(next).toHaveLength(3);
    expect(next.map((o) => o.id)).toEqual(["plan-1", "plan-2", "plan-3"]);
    expect(next.map((o) => o.style)).toEqual(["urgent", "balanced", "gentle"]);
  });

  it("regeneration injects a 'this time' suffix into summary", () => {
    const inputs = blankInputs({ text: "去高数课" });
    const previous = mockGeneratePlanOptions(mockAnalyzeInput(inputs));
    const next = mockRegeneratePlanOptions(inputs, previous);
    next.forEach((opt) => {
      expect(opt.summary).toContain("重新生成");
    });
  });
});

describe("mockGenerateTaskFlow", () => {
  it("returns at most 4 nodes with active first node", () => {
    const analysis = mockAnalyzeInput(blankInputs({ text: "去高数课" }));
    const plan = mockGeneratePlanOptions(analysis)[0];
    const flow = mockGenerateTaskFlow(plan);
    expect(flow.nodes.length).toBeLessThanOrEqual(4);
    expect(flow.nodes[0].status).toBe("active");
  });

  it("nodes have non-empty timeLabel", () => {
    const analysis = mockAnalyzeInput(blankInputs({ text: "今晚交作业" }));
    const plan = mockGeneratePlanOptions(analysis)[1];
    const flow = mockGenerateTaskFlow(plan);
    flow.nodes.forEach((n) => expect(n.timeLabel.length).toBeGreaterThan(0));
  });
});

describe("mockGenerateDeckFromPlan - 去高数课 demo", () => {
  it("coverTitle=去高数课, coverIcon=course, first card is burning demo with concrete action", () => {
    const analysis = mockAnalyzeInput(blankInputs({ text: "去高数课" }));
    const plan = mockGeneratePlanOptions(analysis)[0];
    const flow = mockGenerateTaskFlow(plan);
    const deck = mockGenerateDeckFromPlan(plan, flow, "去高数课");

    expect(deck.coverTitle).toBe("去高数课");
    expect(deck.coverIcon).toBe("course");

    const first = deck.cards[0];
    expect(first.urgencyStage).toBe("burning");
    expect(first.damageEffect).toBe("burn");
    expect(first.burnLevel).toBe(3);
    expect(first.action.length).toBeGreaterThan(5);
    expect(first.title).not.toMatch(/^(学习|复习|完成|准备)$/);
  });

  it("non-course goals do not produce a burning demo first card", () => {
    const analysis = mockAnalyzeInput(blankInputs({ text: "整理一下今天的笔记" }));
    const plan = mockGeneratePlanOptions(analysis)[1];
    const flow = mockGenerateTaskFlow(plan);
    const deck = mockGenerateDeckFromPlan(plan, flow, "整理今日笔记");

    expect(deck.cards[0].urgencyStage).not.toBe("burning");
    expect(deck.cards[0].damageEffect).not.toBe("burn");
  });
});

describe("mockGenerateTimePlanForCard", () => {
  it("returns countdown label when card has deadlineAt", () => {
    const card = baseCard({
      deadlineAt: new Date(Date.now() + 8 * 60_000).toISOString(),
      urgencyStage: "burning",
    });
    const out = mockGenerateTimePlanForCard(card);
    expect(out.windowLabel).toMatch(/min|窗口/);
    expect(out.urgencyStage).toBe("burning");
  });

  it("returns suggested-start label when no deadline", () => {
    const card = baseCard({ deadlineAt: null, suggestedStartAt: new Date().toISOString() });
    const out = mockGenerateTimePlanForCard(card);
    expect(out.windowLabel).toBeTruthy();
  });
});

describe("mockUpdateCardUrgency thresholds", () => {
  const now = new Date("2026-05-16T12:00:00Z");
  const inMin = (m: number) => new Date(now.getTime() + m * 60_000).toISOString();

  it(">20 min => calm", () => {
    const out = mockUpdateCardUrgency(baseCard({ deadlineAt: inMin(30) }), now);
    expect(out.urgencyStage).toBe("calm");
  });

  it("10-20 min => hot", () => {
    const out = mockUpdateCardUrgency(baseCard({ deadlineAt: inMin(15) }), now);
    expect(out.urgencyStage).toBe("hot");
  });

  it("<3 min => burning", () => {
    const out = mockUpdateCardUrgency(baseCard({ deadlineAt: inMin(2) }), now);
    expect(out.urgencyStage).toBe("burning");
  });

  it("expired => expired + crack", () => {
    const out = mockUpdateCardUrgency(baseCard({ deadlineAt: inMin(-5) }), now);
    expect(out.urgencyStage).toBe("expired");
    expect(out.damageEffect).toBe("crack");
  });
});

describe("mockRescheduleFrozenCard", () => {
  it("resets to frozen / freeze / calm with retained context note", () => {
    const card = baseCard({ status: "active", urgencyStage: "burning", damageEffect: "burn" });
    const out = mockRescheduleFrozenCard(card, {
      title: "测试任务流",
      nodes: [],
      edges: [],
      overallProgress: 0,
    });
    expect(out.status).toBe("frozen");
    expect(out.damageEffect).toBe("freeze");
    expect(out.urgencyStage).toBe("calm");
    expect(out.cardBackNote).toContain("测试任务流");
  });
});

describe("mockGenerateProofSummary", () => {
  it("returns a placeholder when there are no records", () => {
    const summary = mockGenerateProofSummary([]);
    expect(summary).toContain("还没有");
  });

  it("includes counts of completed/frozen/burning records", () => {
    const records: ProofRecord[] = [
      makeProof({ status: "completed" }),
      makeProof({ status: "frozen" }),
      makeProof({ status: "rewarded", timeStatus: "burning-completed" }),
    ];
    const summary = mockGenerateProofSummary(records);
    expect(summary).toContain("3");
  });
});

function makeProof(overrides: Partial<ProofRecord> = {}): ProofRecord {
  return {
    id: "proof-1",
    goalTitle: "test",
    source: "text",
    status: "completed",
    progress: 100,
    completedCards: 1,
    frozenCards: 0,
    actualMinutes: 10,
    timeStatus: "on-time",
    timeDamageEvents: [],
    lastAction: "",
    nextSuggestion: "",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

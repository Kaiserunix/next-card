import { describe, expect, it } from "vitest";
import {
  getAgentProfile,
  mockAnalyzeInput,
  mockGenerateDeckFromPlan,
  mockGeneratePlanOptions,
  mockGenerateProofSummary,
  mockGenerateTaskFlow,
  selectAgentForBehavior
} from "@/lib/mock-ai";
import type { InputsState, ProofRecord } from "@/lib/types";

function makeInput(text: string): InputsState {
  return {
    text,
    attachments: [],
    imageSchedule: null,
    parsedText: "",
    sourceType: "text"
  };
}

describe("behavior vector and agent selection", () => {
  it("analyzes 去高数课 as high-confidence, high-time-pressure course execution", () => {
    const analysis = mockAnalyzeInput(makeInput("去高数课"));

    expect(analysis.behaviorVector).toMatchObject({
      expectancy: expect.any(Number),
      taskValue: expect.any(Number),
      procrastination: expect.any(Number),
      timePressure: expect.any(Number)
    });
    expect(analysis.behaviorVector.expectancy).toBeGreaterThanOrEqual(75);
    expect(analysis.behaviorVector.taskValue).toBeGreaterThanOrEqual(70);
    expect(analysis.behaviorVector.procrastination).toBeLessThan(50);
    expect(analysis.behaviorVector.timePressure).toBeGreaterThanOrEqual(85);
    expect(analysis.agentDecision.selectedAgentId).toBe("deadline-guardian");
    expect(analysis.agentDecision.reason).toContain("时间窗口");
  });

  it("chooses sprint-driver when procrastination and deadline pressure are both high", () => {
    const analysis = mockAnalyzeInput(makeInput("这个课程报告我拖了两天，今晚 20:00 ddl，完全不知道怎么开始"));

    expect(analysis.behaviorVector.procrastination).toBeGreaterThanOrEqual(75);
    expect(analysis.behaviorVector.timePressure).toBeGreaterThanOrEqual(85);
    expect(analysis.agentDecision.selectedAgentId).toBe("sprint-driver");
    expect(analysis.behaviorVector.reasons.join(" ")).toContain("拖延");
  });

  it("chooses gentle recovery for low-pressure avoidance instead of stricter pressure", () => {
    const analysis = mockAnalyzeInput(makeInput("整理未来一个月的阅读计划，不着急但一直不想开始"));
    const agent = getAgentProfile(analysis.agentDecision.selectedAgentId);

    expect(analysis.behaviorVector.procrastination).toBeGreaterThanOrEqual(60);
    expect(analysis.behaviorVector.timePressure).toBeLessThan(50);
    expect(agent.id).toBe("gentle-recovery");
    expect(agent.policy.freezeTolerance).toBeGreaterThan(agent.policy.strictness);
  });

  it("keeps meaning-coach for low-value vague tasks that still need a reason to start", () => {
    const decision = selectAgentForBehavior({
      expectancy: 65,
      taskValue: 28,
      procrastination: 35,
      timePressure: 20,
      reasons: ["输入缺少价值信号，先补完成后的证据感。"]
    });

    expect(decision.selectedAgentId).toBe("meaning-coach");
    expect(decision.confidence).toBeGreaterThanOrEqual(0.6);
  });
});

describe("agent policies in planning and cards", () => {
  it("attaches the selected agent policy to the three plan options", () => {
    const analysis = mockAnalyzeInput(makeInput("去高数课"));
    const options = mockGeneratePlanOptions(analysis);

    expect(options.map((option) => option.id)).toEqual(["plan-1", "plan-2", "plan-3"]);
    expect(options[0]).toMatchObject({
      agentId: "deadline-guardian",
      agentName: "截止线守卫"
    });
    expect(options[0].agentPolicy.strictness).toBeGreaterThan(options[1].agentPolicy.strictness);
    expect(options[2].agentPolicy.freezeTolerance).toBeGreaterThan(options[0].agentPolicy.freezeTolerance);
  });

  it("uses high decomposition policy to create smaller action cards", () => {
    const analysis = mockAnalyzeInput(makeInput("论文我拖了很久，完全不知道怎么开始，但今晚 ddl"));
    const selectedPlan = mockGeneratePlanOptions(analysis)[0];
    const flow = mockGenerateTaskFlow(selectedPlan);
    const deck = mockGenerateDeckFromPlan(selectedPlan, flow, "论文最低可交版本");

    expect(selectedPlan.agentId).toBe("sprint-driver");
    expect(deck.agentId).toBe("sprint-driver");
    expect(deck.cards).toHaveLength(6);
    expect(Math.max(...deck.cards.map((card) => card.estimatedMinutes))).toBeLessThanOrEqual(
      selectedPlan.agentPolicy.cardMinuteRange[1]
    );
    expect(deck.cards.every((card) => card.agentId === selectedPlan.agentId)).toBe(true);
  });

  it("summarizes proof evidence with agent language when records include an agent", () => {
    const records: ProofRecord[] = [
      {
        id: "proof-agent",
        goalTitle: "去高数课",
        source: "text",
        status: "completed",
        progress: 100,
        completedCards: 4,
        frozenCards: 0,
        actualMinutes: 12,
        timeStatus: "burning-completed",
        timeDamageEvents: ["截止线守卫触发燃烧提醒后完成"],
        lastDamageEffect: "burn",
        lastAction: "完成：确认高数课时间和教室",
        nextSuggestion: "下一次提前进入平衡节奏",
        createdAt: "2026-05-16T08:00:00.000Z",
        agentId: "deadline-guardian"
      }
    ];

    expect(mockGenerateProofSummary(records)).toContain("截止线守卫");
  });
});

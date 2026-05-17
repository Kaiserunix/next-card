import { describe, expect, it } from "vitest";
import { mergeBackendPlanModeResult } from "@/lib/client/plan-mode-client-adapter";
import type { AnalysisResult, PlanModeTurnResult, PlansState } from "@/lib/types";

const analysis: AnalysisResult = {
  sourceType: "text",
  goalUnderstanding: "本地理解",
  constraints: ["本地约束"],
  stages: ["阶段一"],
  timeStrategy: ["本地时间策略"],
  deadlineLabel: "今晚前",
  availableWindow: "现在",
  suggestedStart: "现在",
  behaviorVector: {
    expectancy: 70,
    taskValue: 80,
    procrastination: 30,
    timePressure: 60,
    reasons: []
  },
  agentDecision: {
    selectedAgentId: "balanced-coach",
    confidence: 0.8,
    reason: "本地选择"
  }
};

const plans: PlansState = {
  goalUnderstanding: "本地理解",
  constraints: ["本地约束"],
  timeStrategy: ["本地时间策略"],
  selectedPlanId: "plan-1",
  regenerateCount: 0,
  options: [
    {
      id: "plan-1",
      name: "方案一",
      style: "urgent",
      summary: "本地方案一",
      estimatedTime: "18 min",
      detailLevel: "high",
      steps: ["本地步骤"],
      agentId: "deadline-guardian",
      agentName: "Deadline Guardian",
      agentPolicy: {
        strictness: 80,
        decomposition: 80,
        pushFrequency: 70,
        burnSensitivity: 70,
        freezeTolerance: 40,
        rewardEmphasis: 40,
        cardMinuteRange: [5, 12],
        tone: "urgent"
      }
    },
    {
      id: "plan-2",
      name: "方案二",
      style: "balanced",
      summary: "本地方案二",
      estimatedTime: "28 min",
      detailLevel: "medium",
      steps: ["本地步骤"],
      agentId: "balanced-coach",
      agentName: "Balanced Coach",
      agentPolicy: {
        strictness: 50,
        decomposition: 60,
        pushFrequency: 50,
        burnSensitivity: 50,
        freezeTolerance: 50,
        rewardEmphasis: 50,
        cardMinuteRange: [8, 18],
        tone: "balanced"
      }
    },
    {
      id: "plan-3",
      name: "方案三",
      style: "gentle",
      summary: "本地方案三",
      estimatedTime: "35 min",
      detailLevel: "low",
      steps: ["本地步骤"],
      agentId: "gentle-recovery",
      agentName: "Gentle Recovery",
      agentPolicy: {
        strictness: 30,
        decomposition: 50,
        pushFrequency: 30,
        burnSensitivity: 30,
        freezeTolerance: 80,
        rewardEmphasis: 70,
        cardMinuteRange: [5, 10],
        tone: "gentle"
      }
    }
  ]
};

const backendResult: PlanModeTurnResult = {
  status: "ready-to-build",
  shouldBuildNow: true,
  analysis: {
    goalUnderstanding: "Mimo 理解：去高数课并准备第一张行动牌",
    knownConstraints: ["课程目标", "需要保留出门缓冲"],
    missingInformation: [],
    timeJudgement: "Mimo 判断：现在适合先发第一张牌。",
    recommendedDealMode: "deal-first-card"
  },
  options: [
    { id: "plan-1", label: "方案一", kind: "build", planId: "plan-1", description: "Mimo 快速方案" },
    { id: "plan-2", label: "方案二", kind: "build", planId: "plan-2", description: "Mimo 平衡方案" },
    { id: "plan-3", label: "方案三", kind: "build", planId: "plan-3", description: "Mimo 低压力方案" },
    { id: "supplement", label: "否，我要自己补充", kind: "supplement", description: "补充信息" }
  ],
  context: {
    messagesUsed: 0,
    facts: []
  }
};

describe("plan mode client adapter", () => {
  it("merges backend Mimo analysis into the existing local deck flow without replacing card-generation data", () => {
    const result = mergeBackendPlanModeResult({ analysis, plans, backendResult });

    expect(result.analysis.goalUnderstanding).toBe("Mimo 理解：去高数课并准备第一张行动牌");
    expect(result.analysis.constraints).toEqual(["课程目标", "需要保留出门缓冲"]);
    expect(result.analysis.timeStrategy[0]).toBe("Mimo 判断：现在适合先发第一张牌。");
    expect(result.plans.options.map((option) => option.summary)).toEqual([
      "Mimo 快速方案",
      "Mimo 平衡方案",
      "Mimo 低压力方案"
    ]);
    expect(result.plans.options[0].agentId).toBe("deadline-guardian");
    expect(result.plans.selectedPlanId).toBe("plan-1");
  });
});

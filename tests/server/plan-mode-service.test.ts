import { describe, expect, it } from "vitest";
import { createPlanModeTurn } from "@/lib/server/plan-mode-service";
import type { PlanModeMessage } from "@/lib/types";

describe("Plan Mode backend service", () => {
  it("returns structured analysis and build options for a course goal without chatbot-style questioning", () => {
    const result = createPlanModeTurn({
      inputText: "我想去高数",
      sourceType: "text",
      messages: []
    });

    expect(result.status).toBe("ready-to-build");
    expect(result.analysis.goalUnderstanding).toContain("高数");
    expect(result.analysis.knownConstraints.length).toBeGreaterThan(0);
    expect(result.analysis.timeJudgement).toContain("默认");
    expect(result.options.map((option) => option.label)).toEqual(
      expect.arrayContaining(["方案一", "方案二", "方案三", "否，我要自己补充"])
    );
    expect(result.assistantQuestion).toBeUndefined();
  });

  it("surfaces missing information as selectable gaps and still offers default card creation", () => {
    const result = createPlanModeTurn({
      inputText: "我想弄一下那个东西",
      sourceType: "text",
      messages: []
    });

    expect(result.status).toBe("needs-supplement");
    expect(result.analysis.missingInformation).toEqual(
      expect.arrayContaining(["具体目标对象", "截止或期望完成时间"])
    );
    expect(result.options.map((option) => option.label)).toEqual(
      expect.arrayContaining(["先按默认建牌", "否，我要自己补充"])
    );
    expect(result.shouldBuildNow).toBe(false);
  });

  it("keeps only the newest 20 context messages while extracting stable facts", () => {
    const messages: PlanModeMessage[] = Array.from({ length: 26 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: index === 25 ? "地点是二教 304，10:00 前到" : `历史消息 ${index}`,
      createdAt: `2026-05-17T08:${String(index).padStart(2, "0")}:00.000Z`
    }));

    const result = createPlanModeTurn({
      inputText: "去高数",
      sourceType: "text",
      messages
    });

    expect(result.context.messagesUsed).toBe(20);
    expect(result.context.facts).toEqual(expect.arrayContaining(["地点是二教 304，10:00 前到"]));
  });
});

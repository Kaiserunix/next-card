import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  mockAnalyzeInput,
  mockGenerateDeckFromPlan,
  mockGeneratePlanOptions,
  mockGenerateTaskFlow
} from "@/lib/mock-ai";
import { expandedAiCases } from "@/tests/fixtures/ai-expanded-cases";

const broadTaskTitles = ["学习数学", "完成作业", "背单词"];

describe("expanded AI input cases", () => {
  it("contains exactly 30 long dialogue, attachment, text, mixed, and timetable image cases", () => {
    expect(expandedAiCases).toHaveLength(30);
    expect(expandedAiCases.filter((item) => item.name.includes("长对话")).length).toBeGreaterThanOrEqual(8);
    expect(expandedAiCases.filter((item) => item.fixtureImagePath).length).toBeGreaterThanOrEqual(9);
    expect(expandedAiCases.filter((item) => item.expectedKind === "course")).toHaveLength(13);
    expect(expandedAiCases.filter((item) => item.expectedKind === "assignment")).toHaveLength(13);
    expect(expandedAiCases.filter((item) => item.expectedKind === "default")).toHaveLength(4);
    expect(new Set(expandedAiCases.map((item) => item.id)).size).toBe(expandedAiCases.length);
  });

  it("keeps all timetable image fixtures available in the workspace", () => {
    for (const item of expandedAiCases.filter((caseItem) => caseItem.fixtureImagePath)) {
      expect(existsSync(join(process.cwd(), item.fixtureImagePath ?? "")), item.id).toBe(true);
      expect(item.input.imageSchedule?.name).toMatch(/\.(svg|png|jpg|jpeg|webp)$/);
      expect(item.input.imageSchedule?.parsedTimetable).toContain("图像课表识别");
    }
  });

  it.each(expandedAiCases)("$id analyzes source and intent correctly", (caseItem) => {
    const analysis = mockAnalyzeInput(caseItem.input);

    expect(analysis.sourceType).toBe(caseItem.expectedSource);
    expect(
      [
        analysis.goalUnderstanding,
        analysis.deadlineLabel,
        analysis.availableWindow,
        analysis.suggestedStart,
        ...analysis.constraints,
        ...analysis.stages,
        ...analysis.timeStrategy
      ].join("\n")
    ).toContain(caseItem.expectedNeedle);

    if (caseItem.expectedKind === "course") {
      expect(analysis.stages).toEqual(["确认课程信息", "整理材料", "出门移动", "到达后课前准备"]);
    }

    if (caseItem.expectedKind === "assignment") {
      expect(analysis.stages).toEqual(["读要求", "做最低可交版本", "补充关键细节", "提交前检查"]);
    }

    if (caseItem.expectedKind === "default") {
      expect(analysis.stages).toEqual(["确认目标边界", "启动最小动作", "连续推进", "收尾留证"]);
    }
  });

  it.each(expandedAiCases)("$id produces exactly three executable plan options", (caseItem) => {
    const analysis = mockAnalyzeInput(caseItem.input);
    const options = mockGeneratePlanOptions(analysis);

    expect(options.map((option) => option.id)).toEqual(["plan-1", "plan-2", "plan-3"]);
    expect(options.map((option) => option.style)).toEqual(["urgent", "balanced", "gentle"]);
    for (const option of options) {
      expect(option.steps).toHaveLength(4);
      expect(option.steps.join("\n")).not.toMatch(/学习数学|完成作业|背单词/);
    }
  });

  it.each(expandedAiCases)("$id can become a task flow and decomposed deck", (caseItem) => {
    const analysis = mockAnalyzeInput(caseItem.input);
    const selectedPlan = mockGeneratePlanOptions(analysis)[0];
    const flow = mockGenerateTaskFlow(selectedPlan);
    const goalTitle =
      caseItem.input.text.trim() ||
      caseItem.input.imageSchedule?.parsedTimetable ||
      caseItem.input.parsedText ||
      caseItem.name;
    const deck = mockGenerateDeckFromPlan(selectedPlan, flow, goalTitle);

    expect(flow.nodes).toHaveLength(4);
    expect(deck.cards.length).toBeGreaterThanOrEqual(4);
    expect(deck.cards.length).toBeLessThanOrEqual(6);
    expect(deck.cards[0].status).toBe("active");

    for (const card of deck.cards) {
      expect(broadTaskTitles).not.toContain(card.title);
      expect(card.action.length).toBeGreaterThan(10);
      expect(card.estimatedMinutes).toBeGreaterThan(0);
      expect(card.flowNodeId).toMatch(/^flow-/);
    }
  });
});

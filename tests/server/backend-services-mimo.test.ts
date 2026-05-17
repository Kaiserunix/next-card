import { describe, expect, it, vi } from "vitest";
import { createBackendPorts } from "@/lib/server/backend-services";

function responseWithJson(content: unknown) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify(content)
          }
        }
      ]
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

describe("backend services Mimo wiring", () => {
  it("uses Mimo for Plan Mode and import parsing when the API key is configured", async () => {
    vi.stubEnv("MIMO_API_KEY", "test-key");
    vi.stubEnv("MIMO_BASE_URL", "https://token-plan-cn.xiaomimimo.com/v1");
    vi.stubEnv("MIMO_PLANNER_MODEL", "planner-model");
    vi.stubEnv("MIMO_MULTIMODAL_MODEL", "vision-model");
    vi.stubEnv("NEXT_CARD_AI_STRICT", "true");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        responseWithJson({
          status: "ready-to-build",
          shouldBuildNow: true,
          analysis: {
            goalUnderstanding: "模型规划：去高数课",
            knownConstraints: ["课程目标"],
            missingInformation: [],
            timeJudgement: "模型识别时间压力。",
            recommendedDealMode: "deal-first-card"
          },
          options: [
            { id: "plan-1", label: "方案一", kind: "build", planId: "plan-1", description: "快走。" },
            { id: "plan-2", label: "方案二", kind: "build", planId: "plan-2", description: "检查教室。" },
            { id: "plan-3", label: "方案三", kind: "build", planId: "plan-3", description: "整理再走。" },
            { id: "supplement", label: "否，我要自己补充", kind: "supplement", description: "补充。" }
          ],
          context: { messagesUsed: 0, facts: [] }
        })
      )
      .mockResolvedValueOnce(
        responseWithJson({
          reviewRequired: true,
          topLevelCards: [
            {
              id: "course-1",
              title: "课程：周一 08:00 高数",
              sourceLine: "周一 08:00 高数",
              timeLabel: "周一 08:00",
              kind: "course",
              reviewStatus: "pending"
            }
          ],
          coverageChecks: [{ kind: "timetable-line-count", passed: true, detail: "识别 1 项。" }],
          possibleOmissions: [],
          conflicts: [],
          userReviewPrompt: "请检阅。"
        })
      );
    vi.stubGlobal("fetch", fetchImpl);

    const ports = createBackendPorts();
    const plan = await ports.aiPlanner.createPlanModeTurn({ inputText: "我想去高数", sourceType: "text" });
    const review = await ports.multimodalImportParser.parseImport({ sourceType: "image", rawText: "周一 08:00 高数" });
    const firstBody = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    const secondBody = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));

    expect(plan.analysis.goalUnderstanding).toBe("模型规划：去高数课");
    expect(review.topLevelCards[0].title).toContain("高数");
    expect(firstBody.model).toBe("planner-model");
    expect(firstBody.response_format).toEqual({ type: "json_object" });
    expect(firstBody.thinking).toEqual({ type: "disabled" });
    expect(secondBody.model).toBe("vision-model");
    expect(secondBody.response_format).toEqual({ type: "json_object" });
    expect(secondBody.thinking).toEqual({ type: "disabled" });
  });
});

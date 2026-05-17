import { describe, expect, it, vi } from "vitest";
import { createMimoAiPlanner, createMimoImportParser, resolveMimoProviderConfig } from "@/lib/server/providers/mimo-ai-provider";
import { createPlanModeTurn } from "@/lib/server/plan-mode-service";
import type { MimoProviderConfig } from "@/lib/server/providers/mimo-ai-provider";

const config: MimoProviderConfig = {
  baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
  apiKey: "test-key",
  plannerModel: "mimo-v2.5-pro",
  multimodalModel: "mimo-v2.5",
  strict: true,
  timeoutMs: 5000
};

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

describe("Mimo OpenAI-compatible AI provider", () => {
  it("calls chat completions with the planner model and returns normalized Plan Mode output", async () => {
    const fetchImpl = vi.fn(async () =>
      responseWithJson({
        status: "ready-to-build",
        shouldBuildNow: true,
        analysis: {
          goalUnderstanding: "用户要去高数课，需要把出门准备拆成卡。",
          knownConstraints: ["课程相关", "需要尽快行动"],
          missingInformation: [],
          timeJudgement: "已识别为课程出发任务，适合先发第一张牌。",
          recommendedDealMode: "deal-first-card"
        },
        options: [
          { id: "plan-1", label: "方案一", kind: "build", planId: "plan-1", description: "立即准备出门。" },
          { id: "plan-2", label: "方案二", kind: "build", planId: "plan-2", description: "先确认教室再准备。" },
          { id: "plan-3", label: "方案三", kind: "build", planId: "plan-3", description: "低压力整理。" },
          { id: "supplement", label: "否，我要自己补充", kind: "supplement", description: "补充教室或时间。" }
        ],
        context: {
          messagesUsed: 1,
          facts: ["地点二教 304"]
        }
      })
    );
    const planner = createMimoAiPlanner({ config, fetchImpl });

    const result = await planner.createPlanModeTurn({
      inputText: "我想去高数",
      sourceType: "text",
      messages: [{ role: "user", content: "地点二教 304", createdAt: "2026-05-17T08:00:00.000Z" }]
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://token-plan-cn.xiaomimimo.com/v1/chat/completions");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key" });
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("mimo-v2.5-pro");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.messages[0].content).toContain("Next Card");
    expect(body.messages[0].content).toContain("JSON");
    expect(result.status).toBe("ready-to-build");
    expect(result.analysis.goalUnderstanding).toContain("高数");
    expect(result.options.map((option) => option.label)).toEqual(["方案一", "方案二", "方案三", "否，我要自己补充"]);
    expect(result.context.facts).toEqual(["地点二教 304"]);
  });

  it("falls back to the deterministic local planner when non-strict model output is invalid", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 })
    );
    const fallback = vi.fn(async (input: Parameters<typeof createPlanModeTurn>[0]) => createPlanModeTurn(input));
    const planner = createMimoAiPlanner({
      config: { ...config, strict: false },
      fetchImpl,
      fallback
    });

    const result = await planner.createPlanModeTurn({
      inputText: "我想去高数",
      sourceType: "text"
    });

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(result.analysis.goalUnderstanding).toContain("高数");
  });

  it("accepts MiMo responses that put JSON in reasoning_content", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "",
                reasoning_content: JSON.stringify({
                  status: "ready-to-build",
                  shouldBuildNow: true,
                  analysis: {
                    goalUnderstanding: "reasoning_content 中的规划结果",
                    knownConstraints: [],
                    missingInformation: [],
                    timeJudgement: "可以建牌。",
                    recommendedDealMode: "deal-first-card"
                  },
                  options: [
                    { id: "plan-1", label: "方案一", kind: "build", planId: "plan-1", description: "A" },
                    { id: "plan-2", label: "方案二", kind: "build", planId: "plan-2", description: "B" },
                    { id: "plan-3", label: "方案三", kind: "build", planId: "plan-3", description: "C" },
                    { id: "supplement", label: "否，我要自己补充", kind: "supplement", description: "D" }
                  ],
                  context: { messagesUsed: 0, facts: [] }
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const planner = createMimoAiPlanner({ config, fetchImpl });

    const result = await planner.createPlanModeTurn({ inputText: "去高数课", sourceType: "text" });

    expect(result.analysis.goalUnderstanding).toBe("reasoning_content 中的规划结果");
  });

  it("uses the multimodal model for import review normalization", async () => {
    const fetchImpl = vi.fn(async () =>
      responseWithJson({
        reviewRequired: true,
        topLevelCards: [
          {
            id: "course-1",
            title: "课程：周一 08:00 高数 二教304",
            sourceLine: "周一 08:00 高数 二教304",
            timeLabel: "周一 08:00",
            kind: "course",
            reviewStatus: "pending"
          },
          {
            id: "deadline-1",
            title: "截止：周五 20:00 课程报告截止",
            sourceLine: "周五 20:00 课程报告截止",
            timeLabel: "周五 20:00",
            kind: "deadline",
            reviewStatus: "pending"
          }
        ],
        dealNowCards: [],
        hiddenBacklogCards: [],
        coverageChecks: [
          { kind: "timetable-line-count", passed: true, detail: "识别 2 个顶层项目。" },
          { kind: "deadline-count", passed: true, detail: "截止项目已进入顶层牌。" },
          { kind: "reminder-count", passed: true, detail: "没有提醒项目。" },
          { kind: "conflict-scan", passed: true, detail: "未发现同时间冲突。" },
          { kind: "omission-scan", passed: true, detail: "未发现明显遗漏。" }
        ],
        possibleOmissions: [],
        conflicts: [],
        userReviewPrompt: "请检阅识别出的顶层牌。"
      })
    );
    const parser = createMimoImportParser({ config, fetchImpl });

    const result = await parser.parseImport({
      sourceType: "image",
      rawText: "周一 08:00 高数 二教304\n周五 20:00 课程报告截止",
      attachmentName: "课表.png"
    });

    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("mimo-v2.5");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(result.reviewRequired).toBe(true);
    expect(result.topLevelCards).toHaveLength(2);
    expect(result.dealNowCards).toHaveLength(2);
    expect(result.hiddenBacklogCards).toHaveLength(0);
  });

  it("sends image payloads to the multimodal model using OpenAI-compatible image_url content", async () => {
    const imageDataUrl = "data:image/jpeg;base64,aW1hZ2UtYnl0ZXM=";
    const fetchImpl = vi.fn(async () =>
      responseWithJson({
        reviewRequired: true,
        topLevelCards: [
          {
            id: "course-1",
            title: "课程：5月11日 周一 第1节 大学物理B",
            sourceLine: "5月11日 周一 第1节 08:00-09:35 大学物理B（上）",
            timeLabel: "5月11日 周一 第1节 08:00",
            kind: "course",
            reviewStatus: "pending"
          }
        ],
        dealNowCards: [],
        hiddenBacklogCards: [],
        coverageChecks: [],
        possibleOmissions: [],
        conflicts: [],
        userReviewPrompt: "请检阅图片课表识别结果。"
      })
    );
    const parser = createMimoImportParser({ config, fetchImpl });

    const result = await parser.parseImport({
      sourceType: "image",
      rawText: "",
      imageDataUrl,
      imageMimeType: "image/jpeg",
      attachmentName: "real-timetable.jpg"
    });

    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    const userMessage = body.messages[1];

    expect(body.model).toBe("mimo-v2.5");
    expect(userMessage.content).toEqual([
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("real-timetable.jpg")
      }),
      {
        type: "image_url",
        image_url: {
          url: imageDataUrl
        }
      }
    ]);
    expect(result.topLevelCards).toHaveLength(1);
    expect(result.topLevelCards[0]).toMatchObject({ kind: "course" });
  });

  it("resolves Mimo config only when an API key is present", () => {
    expect(resolveMimoProviderConfig({})).toBeNull();
    expect(
      resolveMimoProviderConfig({
        MIMO_API_KEY: "key",
        MIMO_BASE_URL: "https://example.com/v1",
        MIMO_PLANNER_MODEL: "planner",
        MIMO_MULTIMODAL_MODEL: "vision",
        NEXT_CARD_AI_STRICT: "true"
      })
    ).toEqual({
      baseUrl: "https://example.com/v1",
      apiKey: "key",
      plannerModel: "planner",
      multimodalModel: "vision",
      strict: true,
      timeoutMs: 30000
    });
  });
});

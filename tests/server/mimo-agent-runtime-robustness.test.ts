import { describe, expect, it, vi } from "vitest";
import { createBackendPorts } from "@/lib/server/backend-services";
import { AGENT_AUTO_TRIGGERS, buildAgentRuntimePlan } from "@/lib/server/agent-runtime";
import { createMimoAiPlanner, createMimoImportParser } from "@/lib/server/providers/mimo-ai-provider";
import type { MimoProviderConfig } from "@/lib/server/providers/mimo-ai-provider";

const strictConfig: MimoProviderConfig = {
  baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
  apiKey: "test-key",
  plannerModel: "mimo-v2.5-pro",
  multimodalModel: "mimo-v2.5",
  strict: true,
  timeoutMs: 5000
};

function chatResponse(content: unknown, init?: ResponseInit) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: typeof content === "string" ? content : JSON.stringify(content)
          }
        }
      ]
    }),
    { status: 200, headers: { "content-type": "application/json" }, ...init }
  );
}

describe("Mimo provider and agent runtime robustness", () => {
  it("uses deterministic local services when no Mimo key is configured", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("MIMO_API_KEY", "");
    vi.stubEnv("NEXT_CARD_MIMO_API_KEY", "");
    vi.stubEnv("MIMO_OPENAI_API_KEY", "");
    vi.stubEnv("NEXT_CARD_QUEUE_REPOSITORY", "memory");
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    const ports = createBackendPorts();
    const turn = await ports.aiPlanner.createPlanModeTurn({ inputText: "去高数课", sourceType: "text" });
    const review = await ports.multimodalImportParser.parseImport({
      sourceType: "image",
      rawText: "周一 08:00 高数 二教304"
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(turn.analysis.goalUnderstanding).toContain("高数");
    expect(review.topLevelCards[0].title).toContain("高数");
  });

  it("throws a strict planner error that preserves HTTP non-2xx details", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "Invalid API Key" } }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    );
    const planner = createMimoAiPlanner({ config: strictConfig, fetchImpl });

    await expect(planner.createPlanModeTurn({ inputText: "写作业", sourceType: "text" })).rejects.toThrow(
      "Mimo planner failed: HTTP 401: Invalid API Key"
    );
  });

  it("throws a strict multimodal import parser error when model content is not JSON", async () => {
    const fetchImpl = vi.fn(async () => chatResponse("我会先解释一下，然后再说结果。"));
    const parser = createMimoImportParser({ config: strictConfig, fetchImpl });

    await expect(
      parser.parseImport({ sourceType: "image", rawText: "图片时间表：周二 10:00 英语" })
    ).rejects.toThrow("Mimo multimodal import parser failed: model response is not JSON");
  });

  it("normalizes sparse planner output instead of leaking missing model fields", async () => {
    const fetchImpl = vi.fn(async () =>
      chatResponse({
        status: "unknown",
        shouldBuildNow: true,
        analysis: {
          goalUnderstanding: "",
          knownConstraints: ["  明天前  ", ""],
          recommendedDealMode: "move-everything"
        },
        options: [{ id: "", label: "", kind: "build", description: "" }],
        context: { messagesUsed: 99, facts: ["  只保留有效事实  ", ""] }
      })
    );
    const planner = createMimoAiPlanner({ config: strictConfig, fetchImpl });

    const result = await planner.createPlanModeTurn({
      inputText: "补交实验报告",
      sourceType: "attachment",
      messages: [{ role: "user", content: "明天前", createdAt: "2026-05-17T08:00:00.000Z" }]
    });

    expect(result.status).toBe("ready-to-build");
    expect(result.analysis.goalUnderstanding).toBe("已理解用户目标，准备进入结构化建牌。");
    expect(result.analysis.knownConstraints).toEqual(["明天前"]);
    expect(result.analysis.timeJudgement).toBe("未识别明确时间，先按默认启动窗口处理。");
    expect(result.analysis.recommendedDealMode).toBe("review-before-deal");
    expect(result.options.map((option) => option.id)).toEqual(["plan-1", "plan-2", "plan-3", "supplement"]);
    expect(result.context.messagesUsed).toBe(1);
    expect(result.context.facts).toEqual(["只保留有效事实"]);
  });

  it("accepts reasoning_content JSON and limits multimodal import review deal-now cards to two", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "",
                reasoning_content: JSON.stringify({
                  reviewRequired: true,
                  topLevelCards: [
                    { id: "course-1", title: "课程：高数", sourceLine: "周一 08:00 高数", kind: "course" },
                    { id: "course-2", title: "课程：英语", sourceLine: "周二 10:00 英语", kind: "course" },
                    { id: "deadline-1", title: "截止：实验报告", sourceLine: "周三 20:00 实验报告", kind: "deadline" },
                    { id: "reminder-1", title: "提醒：带教材", sourceLine: "明早带教材", kind: "reminder" }
                  ],
                  dealNowCards: [
                    { id: "course-1", title: "课程：高数", sourceLine: "周一 08:00 高数", kind: "course" },
                    { id: "course-2", title: "课程：英语", sourceLine: "周二 10:00 英语", kind: "course" },
                    { id: "deadline-1", title: "截止：实验报告", sourceLine: "周三 20:00 实验报告", kind: "deadline" }
                  ],
                  hiddenBacklogCards: [],
                  coverageChecks: [],
                  possibleOmissions: [],
                  conflicts: []
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const parser = createMimoImportParser({ config: strictConfig, fetchImpl });

    const result = await parser.parseImport({
      sourceType: "mixed",
      rawText: "课程表和提醒混合文本"
    });

    expect(result.dealNowCards.map((card) => card.id)).toEqual(["course-1", "course-2"]);
    expect(result.hiddenBacklogCards.map((card) => card.id)).toEqual(["deadline-1", "reminder-1"]);
    expect(result.coverageChecks.map((check) => check.kind)).toEqual([
      "timetable-line-count",
      "deadline-count",
      "reminder-count",
      "conflict-scan",
      "omission-scan"
    ]);
  });

  it("keeps large multimodal import runtime skills behind review before queue effects", () => {
    const trigger = AGENT_AUTO_TRIGGERS.find((item) => item.kind === "large-import-received");
    const plan = buildAgentRuntimePlan({
      trigger: "large-import-received",
      agentId: "micro-splitter",
      sourceType: "mixed"
    });

    expect(trigger).toMatchObject({
      cadence: "immediate",
      background: false
    });
    expect(plan.skillOrder.slice(0, 3)).toEqual(["multimodal-import", "coverage-review", "review-gate"]);
    expect(plan.skillOrder.indexOf("review-gate")).toBeLessThan(plan.skillOrder.indexOf("hidden-goal-reveal"));
    expect(plan.requiresUserReview).toBe(true);
    expect(plan.guards).toContain("large-imports-require-user-review");
    expect(plan.queueActions).toEqual(["reveal-hidden-goal", "deal-card"]);
  });

  it("plans scheduled worker ticks with time-lock guard before scheduling and provider dispatch", () => {
    const plan = buildAgentRuntimePlan({
      trigger: "worker-tick",
      agentId: "deadline-guardian",
      sourceType: "text"
    });

    expect(plan.skillOrder.indexOf("priority-score")).toBeLessThan(plan.skillOrder.indexOf("time-lock-guard"));
    expect(plan.skillOrder.indexOf("time-lock-guard")).toBeLessThan(plan.skillOrder.indexOf("schedule-insert"));
    expect(plan.skillOrder.indexOf("schedule-insert")).toBeLessThan(plan.skillOrder.indexOf("reminder-calendar-sync"));
    expect(plan.guards).toEqual(
      expect.arrayContaining(["mimo-cannot-write-queue-directly", "hard-time-locks-are-suggest-only"])
    );
    expect(plan.queueActions).toEqual([
      "insert-task",
      "move-task",
      "deal-card",
      "create-reminder",
      "create-calendar-event"
    ]);
  });
});

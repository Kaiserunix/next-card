import { describe, expect, it } from "vitest";
import { POST as planModePost } from "@/app/api/backend/plan-mode/route";
import { createPlanModeTurn } from "@/lib/server/plan-mode-service";
import type { PlanModeMessage, PlanModeTurnResult } from "@/lib/types";

function message(role: PlanModeMessage["role"], content: string, index: number): PlanModeMessage {
  return {
    role,
    content,
    createdAt: `2026-05-17T08:${String(index).padStart(2, "0")}:00.000Z`
  };
}

function expectStructuredPlanModeResponse(result: PlanModeTurnResult) {
  expect(result.analysis.goalUnderstanding.length).toBeGreaterThan(0);
  expect(result.analysis.knownConstraints.length).toBeGreaterThan(0);
  expect(result.analysis.missingInformation).toEqual(expect.any(Array));
  expect(result.analysis.timeJudgement.length).toBeGreaterThan(0);
  expect(result.options.length).toBeGreaterThanOrEqual(2);
  expect(result.options).toEqual(expect.arrayContaining([expect.objectContaining({ label: "否，我要自己补充" })]));
  expect(result.assistantQuestion).toBeUndefined();
}

function planModeRequest(body: unknown) {
  return new Request("http://next-card.test/api/backend/plan-mode", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" }
  });
}

describe("usage simulation: Plan Mode multi-turn context", () => {
  it("starts vague goals as structured Plan Mode output instead of chat-style repeated questioning", () => {
    for (const inputText of ["我想去高数", "准备考试", "处理通知"]) {
      const result = createPlanModeTurn({
        inputText,
        sourceType: "text",
        messages: []
      });

      expectStructuredPlanModeResponse(result);
      expect(result.options).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: "review" })]));
    }
  });

  it("retains user supplements across five simulated turns and becomes ready to build when enough context exists", () => {
    const messages: PlanModeMessage[] = [];
    const supplements = [
      "考试是高数，但我现在只有一个小时，想先保底。",
      "明天 09:00 考，重点是极限和导数。",
      "今晚 20:30 到 21:30 能复习，22:00 后不想再学。",
      "我最担心不会证明题，想先做最低分保底。",
      "资料在课本第三章和上次错题本。"
    ];

    let result: PlanModeTurnResult | undefined;

    supplements.forEach((supplement, index) => {
      messages.push(message("user", supplement, index * 2));

      result = createPlanModeTurn({
        inputText: "准备考试",
        sourceType: "text",
        messages
      });

      expectStructuredPlanModeResponse(result);

      messages.push(message("assistant", "已按结构化 Plan Mode 更新分析、缺口和可执行选项。", index * 2 + 1));
    });

    expect(result).toBeDefined();
    expect(result?.status).toBe("ready-to-build");
    expect(result?.shouldBuildNow).toBe(true);
    expect(result?.options.map((option) => option.label)).toEqual([
      "方案一",
      "方案二",
      "方案三",
      "否，我要自己补充"
    ]);
    expect(result?.context.facts).toEqual(expect.arrayContaining(supplements));
    expect(result?.analysis.knownConstraints.join("\n")).toContain("错题本");
  });

  it("uses API message facts to build from an originally vague goal once context names the course and time lock", async () => {
    const factMessages = [
      message("user", "是明天早八的高数课，教室二教304", 0),
      message("user", "课前要带教材和上次作业页，07:40 前出门", 1)
    ];

    const response = await planModePost(
      planModeRequest({
        inputText: "我想弄一下",
        sourceType: "text",
        messages: factMessages
      })
    );
    const result = (await response.json()) as PlanModeTurnResult;

    expect(response.status).toBe(200);
    expect(result.context.facts).toEqual([
      "是明天早八的高数课，教室二教304",
      "课前要带教材和上次作业页，07:40 前出门"
    ]);
    expect(result.status).toBe("ready-to-build");
    expect(result.shouldBuildNow).toBe(true);
    expect(result.analysis.missingInformation).not.toContain("具体目标对象");
    expect(result.options.map((option) => option.label)).toEqual([
      "方案一",
      "方案二",
      "方案三",
      "否，我要自己补充"
    ]);
  });

  it("stops at the ten-turn / twenty-message boundary with default build choices instead of infinite questioning", () => {
    const messages: PlanModeMessage[] = Array.from({ length: 20 }, (_, index) =>
      index % 2 === 0
        ? message("user", `还是很模糊，只知道要处理通知，第 ${index / 2 + 1} 轮补充。`, index)
        : message("assistant", "已给出结构化缺口、默认建牌和补充入口。", index)
    );

    const result = createPlanModeTurn({
      inputText: "处理通知",
      sourceType: "text",
      messages
    });

    expectStructuredPlanModeResponse(result);
    expect(result.context.messagesUsed).toBe(20);
    expect(result.status).toBe("needs-supplement");
    expect(result.shouldBuildNow).toBe(false);
    expect(result.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "default-build", kind: "default-build", label: "先按默认建牌" }),
        expect.objectContaining({ id: "supplement", kind: "supplement", label: "否，我要自己补充" })
      ])
    );
  });
});

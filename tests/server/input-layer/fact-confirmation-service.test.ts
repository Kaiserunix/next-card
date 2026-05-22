import { describe, expect, it } from "vitest";
import { confirmFacts } from "@/lib/server/input-layer/fact-confirmation-service";
import { createPlanCompilerHandoff } from "@/lib/server/input-layer/plan-handoff-service";
import type { FactConfirmationRequest } from "@/lib/server/input-layer/types";

describe("confirmFacts", () => {
  it("creates a verified bundle for a small go-to-calculus input while keeping location non-blocking", () => {
    const result = confirmFacts({
      request: request({
        summary: "事件：去高数课；时间：明天早八；地点：待补",
        facts: [
          { id: "fact_task", field: "event", label: "事件", value: "去高数课", confidence: 0.9, evidenceRefs: [] },
          { id: "fact_time", field: "time", label: "时间", value: "明天早八", confidence: 0.85, evidenceRefs: [] },
          { id: "fact_type", field: "taskType", label: "类型", value: "course-arrival", confidence: 0.9, evidenceRefs: [] },
        ],
        missingFields: ["location"],
      }),
      action: "confirm",
    });

    expect(result.nextAction).toBe("send-to-plan-compiler");
    expect(result.verifiedInputBundle?.verifiedTaskFacts[0]).toMatchObject({ title: "去高数课" });
    expect(result.planCompilerHandoff?.mustGenerateABC).toBe(true);
    expect(result.planCompilerHandoff?.missingButNonBlocking).toContain("location");
  });

  it("includes explicit deadline constraints in the Plan Compiler handoff", () => {
    const result = confirmFacts({
      request: request({
        summary: "事件：交英语作文；时间：今晚八点前",
        facts: [
          { id: "fact_task", field: "event", label: "事件", value: "交英语作文", confidence: 0.9, evidenceRefs: [] },
          { id: "fact_deadline", field: "deadline", label: "截止", value: "今晚八点前", confidence: 0.9, evidenceRefs: [] },
        ],
      }),
      action: "confirm",
    });

    expect(result.planCompilerHandoff?.constraints).toContain("deadline: 今晚八点前");
  });

  it("does not hand off rough-scope multimodal requests directly", () => {
    const result = confirmFacts({
      request: request({
        mode: "rough-scope",
        summary: "从课表里看到周一 8:00 高数",
        facts: [{ id: "fact_course", field: "event", label: "课程", value: "高数", confidence: 0.7, evidenceRefs: [] }],
      }),
      action: "confirm",
    });

    expect(result.nextAction).toBe("show-strict-review");
    expect(result.planCompilerHandoff).toBeUndefined();
  });

  it("uses user corrections over extracted values while retaining evidence refs", () => {
    const result = confirmFacts({
      request: request({
        summary: "事件：交英语作文；时间：5 月 22 日 12:00 前",
        facts: [
          {
            id: "fact_deadline",
            field: "deadline",
            label: "截止",
            value: "5 月 22 日 12:00 前",
            confidence: 0.75,
            evidenceRefs: [{ rawInputId: "raw_1", quote: "12:00", confidence: 0.75 }],
          },
        ],
      }),
      action: "correct",
      corrections: { deadline: "5 月 22 日 20:00 前" },
    });

    expect(result.verifiedInputBundle?.verifiedTimeFacts[0]).toMatchObject({
      label: "5 月 22 日 20:00 前",
      correctedFrom: "5 月 22 日 12:00 前",
    });
    expect(result.verifiedInputBundle?.evidenceRefs[0]?.quote).toBe("12:00");
  });

  it("does not save verified bundles when the user rejects confirmation", () => {
    const result = confirmFacts({
      request: request({ summary: "事件：去高数课" }),
      action: "reject",
    });

    expect(result.nextAction).toBe("retry-input");
    expect(result.verifiedInputBundle).toBeUndefined();
  });
});

describe("createPlanCompilerHandoff", () => {
  it("always requires A/B/C generation and excludes committed runtime state", () => {
    const handoff = createPlanCompilerHandoff({
      id: "bundle_1",
      rawInputId: "raw_1",
      verifiedTaskFacts: [{ id: "task_1", title: "去高数课", taskType: "course-arrival", confidence: 1 }],
      verifiedTimeFacts: [],
      verifiedLocationFacts: [],
      lifecycle: "unknown",
      tensionLevel: "unknown",
      confirmationStatus: "confirmed",
      evidenceRefs: [],
      readyForPlanCompiler: true,
    });

    expect(handoff.mustGenerateABC).toBe(true);
    expect(JSON.stringify(handoff)).not.toContain("selectedPlan");
    expect(JSON.stringify(handoff)).not.toContain("committedDeck");
    expect(JSON.stringify(handoff)).not.toContain("reminderJob");
    expect(JSON.stringify(handoff)).not.toContain("proof");
  });
});

function request(overrides: Partial<FactConfirmationRequest>): FactConfirmationRequest {
  return {
    id: "confirm_1",
    rawInputId: "raw_1",
    mode: "light-card",
    summary: "事件：去高数课",
    facts: [],
    missingFields: [],
    riskReasons: [],
    canProceedToPlanMode: false,
    ...overrides,
  };
}

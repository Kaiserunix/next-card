import { describe, expect, it } from "vitest";
import { evaluateMultimodalRisk } from "@/lib/server/input-layer/multimodal-risk-rules";
import type { InputExtractionResult, RawInput } from "@/lib/server/input-layer/types";

describe("evaluateMultimodalRisk", () => {
  it("requires strict review for image schedules", () => {
    const decision = evaluateMultimodalRisk(raw("image"), extraction({ warnings: [] }));

    expect(decision.reviewRequirement).toBe("strict");
    expect(decision.warnings).toContain("high_risk_multimodal");
  });

  it("requires strict review when hard time candidates lack evidence", () => {
    const decision = evaluateMultimodalRisk(
      raw("pdf"),
      extraction({
        warnings: [],
        evidence: [],
        timeConstraints: [{ id: "time_1", kind: "deadline", label: "20:00 前", isHard: true, confidence: 0.9 }],
      }),
    );

    expect(decision.reviewRequirement).toBe("strict");
    expect(decision.warnings).toContain("hard_time_without_evidence");
  });

  it("blocks isolated prompt injection when extraction cannot provide evidence separation", () => {
    const decision = evaluateMultimodalRisk(
      raw("docx"),
      extraction({ warnings: ["prompt_injection_like_text"], evidence: [], confidence: 0.2 }),
    );

    expect(decision.reviewRequirement).toBe("blocked");
  });
});

function raw(sourceType: RawInput["sourceType"]): RawInput {
  return {
    id: `raw_${sourceType}`,
    sourceType,
    sourceHash: "d".repeat(64),
    locale: "zh-CN",
    createdAt: "2026-05-21T08:00:00.000Z",
    receivedAt: "2026-05-21T08:00:00.000Z",
    privacyFlags: [],
    retentionPolicy: {
      rawRetentionDays: 7,
      derivedRetentionDays: 30,
      userDeletable: true,
    },
  };
}

function extraction(overrides: Partial<InputExtractionResult> & { timeConstraints?: InputExtractionResult["candidates"]["timeConstraints"] }): InputExtractionResult {
  return {
    id: "extract_1",
    rawInputId: "raw_image",
    candidates: {
      tasks: [],
      timeConstraints: overrides.timeConstraints ?? [],
      locations: [],
      courses: [],
      reminders: [],
    },
    confidence: overrides.confidence ?? 0.8,
    ambiguities: [],
    warnings: overrides.warnings ?? [],
    evidence: overrides.evidence ?? [{ rawInputId: "raw_image", quote: "周一 8:00", confidence: 0.8 }],
    reviewRequirement: "light",
  };
}

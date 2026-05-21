import { describe, expect, it } from "vitest";
import { evaluateVoicePlanReadiness } from "@/lib/server/voice/readiness-service";

describe("evaluateVoicePlanReadiness", () => {
  it("allows high-confidence actionable transcript into direct Plan Mode", () => {
    const result = evaluateVoicePlanReadiness({
      normalizedText: "明天早八高数课提醒我 7 点 40 出门。",
      confidence: 0.92,
      normalizationChangedTooMuch: false,
    });

    expect(result.gate).toBe("direct-plan");
    expect(result.missingInfoChips).toEqual([]);
  });

  it("asks for lightweight understanding confirmation on unresolved references", () => {
    const result = evaluateVoicePlanReadiness({
      normalizedText: "明天那个作业。",
      confidence: 0.66,
      normalizationChangedTooMuch: false,
    });

    expect(result.gate).toBe("confirm-understanding");
    expect(result.missingInfoChips).toContain("具体任务对象");
  });

  it("returns retry-transcript for unusably short speech", () => {
    const result = evaluateVoicePlanReadiness({
      normalizedText: "那个。",
      confidence: 0.3,
      normalizationChangedTooMuch: false,
    });

    expect(result.gate).toBe("retry-transcript");
  });
});

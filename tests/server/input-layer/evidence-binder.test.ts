import { describe, expect, it } from "vitest";
import { bindEvidenceForExtraction } from "@/lib/server/input-layer/evidence-binder";
import type { InputExtractionResult } from "@/lib/server/input-layer/types";

describe("bindEvidenceForExtraction", () => {
  it("accepts deadline candidates backed by quote evidence", () => {
    const result = bindEvidenceForExtraction(
      extraction({
        timeConstraints: [{ id: "time_1", kind: "deadline", label: "今晚八点前", isHard: true, confidence: 0.9 }],
        evidence: [{ rawInputId: "raw_1", quote: "今晚八点前", confidence: 0.9 }],
      }),
    );

    expect(result.warnings).not.toContain("hard_time_without_evidence");
    expect(result.evidenceSummary).toContain("今晚八点前");
  });

  it("warns when a hard time candidate has no source evidence", () => {
    const result = bindEvidenceForExtraction(
      extraction({
        timeConstraints: [{ id: "time_1", kind: "hard-lock", label: "周一 8:00", isHard: true, confidence: 0.9 }],
        evidence: [],
      }),
    );

    expect(result.warnings).toContain("hard_time_without_evidence");
  });
});

function extraction(overrides: {
  timeConstraints: InputExtractionResult["candidates"]["timeConstraints"];
  evidence: InputExtractionResult["evidence"];
}): InputExtractionResult {
  return {
    id: "extract_1",
    rawInputId: "raw_1",
    candidates: {
      tasks: [],
      timeConstraints: overrides.timeConstraints,
      locations: [],
      courses: [],
      reminders: [],
    },
    confidence: 0.9,
    ambiguities: [],
    warnings: [],
    evidence: overrides.evidence,
    reviewRequirement: "light",
  };
}

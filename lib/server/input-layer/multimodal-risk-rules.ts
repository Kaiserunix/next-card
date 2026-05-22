import type { InputExtractionResult, InputWarning, RawInput, ReviewRequirement } from "@/lib/server/input-layer/types";
import { uniqueWarnings } from "@/lib/server/input-layer/types";

export type MultimodalRiskDecision = {
  reviewRequirement: ReviewRequirement;
  warnings: InputWarning[];
};

const HIGH_RISK_SOURCES = new Set<RawInput["sourceType"]>(["image", "pdf", "docx", "notification", "mixed"]);
const STRICT_WARNINGS = new Set<InputWarning>([
  "relative_date",
  "missing_timezone",
  "conflicting_deadline",
  "low_confidence_time",
  "table_parse_result",
  "course_time",
  "exam_time",
  "submission_deadline",
  "location_affects_arrival",
  "lifecycle_ambiguous",
  "multiple_goals",
]);

export function evaluateMultimodalRisk(rawInput: RawInput, extraction: InputExtractionResult): MultimodalRiskDecision {
  const warnings = [...extraction.warnings];

  if (HIGH_RISK_SOURCES.has(rawInput.sourceType)) warnings.push("high_risk_multimodal");
  if (!rawInput.timezone && extraction.candidates.timeConstraints.length > 0) warnings.push("missing_timezone");
  if (hardTimeWithoutEvidence(extraction)) warnings.push("hard_time_without_evidence");

  const unique = uniqueWarnings(warnings);

  if (
    unique.includes("prompt_injection_like_text") &&
    extraction.evidence.length === 0 &&
    extraction.confidence < 0.35
  ) {
    return {
      reviewRequirement: "blocked",
      warnings: unique,
    };
  }

  if (
    HIGH_RISK_SOURCES.has(rawInput.sourceType) ||
    unique.some((warning) => STRICT_WARNINGS.has(warning)) ||
    unique.includes("hard_time_without_evidence") ||
    unique.includes("prompt_injection_like_text")
  ) {
    return {
      reviewRequirement: "strict",
      warnings: unique,
    };
  }

  return {
    reviewRequirement: extraction.reviewRequirement,
    warnings: unique,
  };
}

function hardTimeWithoutEvidence(extraction: InputExtractionResult): boolean {
  const hasHardTime = extraction.candidates.timeConstraints.some((time) => time.isHard);
  return hasHardTime && extraction.evidence.length === 0;
}

import { detectTimeConflicts } from "@/lib/server/input-layer/conflict-detector";
import { bindEvidenceForExtraction } from "@/lib/server/input-layer/evidence-binder";
import { evaluateInputReadiness, toFactConfirmationRequest } from "@/lib/server/input-layer/readiness-service";
import type {
  FactConfirmationRequest,
  InputExtractionResult,
  InputWarning,
  RawInput,
  ReviewRequirement,
  VerifiedInputBundle,
} from "@/lib/server/input-layer/types";
import { uniqueWarnings } from "@/lib/server/input-layer/types";

export type ReviewGateInput = {
  rawInput: RawInput;
  extraction: InputExtractionResult;
  existingVerifiedFacts?: VerifiedInputBundle[];
};

export type ReviewGateDecision = {
  requirement: ReviewRequirement;
  reasons: InputWarning[];
  confirmationRequest: FactConfirmationRequest;
};

const STRICT_REASONS = new Set<InputWarning>([
  "high_risk_multimodal",
  "relative_date",
  "missing_timezone",
  "conflicting_deadline",
  "low_confidence_time",
  "table_parse_result",
  "exam_time",
  "submission_deadline",
  "course_time",
  "hard_time_without_evidence",
  "location_affects_arrival",
  "lifecycle_ambiguous",
  "multiple_goals",
]);

export function runReviewGate(input: ReviewGateInput): ReviewGateDecision {
  const extractionWithEvidence = withSmallInputSourceEvidence(input.rawInput, input.extraction);
  const evidence = bindEvidenceForExtraction(extractionWithEvidence);
  const conflicts = detectTimeConflicts(extractionWithEvidence, input.existingVerifiedFacts);
  const reasons = uniqueWarnings([
    ...extractionWithEvidence.warnings,
    ...evidence.warnings,
    ...(conflicts.length > 0 ? (["conflicting_deadline"] as InputWarning[]) : []),
  ]);

  const requirement = decideRequirement({ ...input, extraction: extractionWithEvidence }, reasons);
  const extractionForRequest: InputExtractionResult = {
    ...extractionWithEvidence,
    warnings: reasons,
    ambiguities: conflicts.length > 0 ? [...input.extraction.ambiguities, "存在时间冲突，需要展示双来源"] : input.extraction.ambiguities,
    reviewRequirement: requirement,
  };
  const readiness = evaluateInputReadiness({ rawInput: input.rawInput, extraction: extractionForRequest });
  const confirmationRequest = toFactConfirmationRequest(input.rawInput, extractionForRequest, readiness);

  return {
    requirement,
    reasons,
    confirmationRequest: conflicts.length > 0
      ? {
          ...confirmationRequest,
          summary: `${confirmationRequest.summary} 检测到冲突：候选时间 ${conflicts[0]?.candidateTime} 与已有时间 ${conflicts[0]?.existingTime} 不一致。`,
        }
      : confirmationRequest,
  };
}

function withSmallInputSourceEvidence(rawInput: RawInput, extraction: InputExtractionResult): InputExtractionResult {
  if (!rawInput.text || !["voice", "manual-dictation", "text"].includes(rawInput.sourceType)) return extraction;

  const evidence = [...extraction.evidence];
  for (const time of extraction.candidates.timeConstraints) {
    const alreadyBacked = evidence.some((item) => item.quote && item.quote.includes(time.label));
    if (alreadyBacked) continue;

    const start = rawInput.text.indexOf(time.label);
    evidence.push({
      rawInputId: rawInput.id,
      quote: time.label,
      textSpan: start >= 0 ? { start, end: start + time.label.length } : undefined,
      confidence: time.confidence,
    });
  }

  return {
    ...extraction,
    evidence,
  };
}

function decideRequirement(input: ReviewGateInput, reasons: InputWarning[]): ReviewRequirement {
  if (
    input.extraction.reviewRequirement === "blocked" ||
    (reasons.includes("prompt_injection_like_text") && input.extraction.evidence.length === 0 && input.extraction.confidence < 0.35)
  ) {
    return "blocked";
  }

  if (input.extraction.reviewRequirement === "strict" || reasons.some((reason) => STRICT_REASONS.has(reason))) {
    return "strict";
  }

  if (input.extraction.reviewRequirement === "none") return "none";
  return "light";
}

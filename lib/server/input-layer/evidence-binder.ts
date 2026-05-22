import type { InputExtractionResult, InputWarning } from "@/lib/server/input-layer/types";
import { uniqueWarnings } from "@/lib/server/input-layer/types";

export type EvidenceBindingResult = {
  warnings: InputWarning[];
  evidenceSummary: string;
};

export function bindEvidenceForExtraction(extraction: InputExtractionResult): EvidenceBindingResult {
  const warnings = [...extraction.warnings];

  for (const time of extraction.candidates.timeConstraints) {
    if (!time.isHard) continue;
    const backed = extraction.evidence.some((evidence) => {
      return Boolean(evidence.quote && (time.label.includes(evidence.quote) || evidence.quote.includes(time.label)));
    });
    if (!backed) warnings.push("hard_time_without_evidence");
  }

  return {
    warnings: uniqueWarnings(warnings),
    evidenceSummary: extraction.evidence
      .map((evidence) => evidence.quote)
      .filter((quote): quote is string => Boolean(quote))
      .join("；"),
  };
}

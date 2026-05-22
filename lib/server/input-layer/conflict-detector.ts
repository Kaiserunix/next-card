import type { InputExtractionResult, VerifiedInputBundle } from "@/lib/server/input-layer/types";

export type InputLayerConflict = {
  kind: "deadline-conflict" | "hard-lock-conflict";
  candidateLabel: string;
  candidateTime: string;
  existingTime: string;
  existingBundleId: string;
};

export function detectTimeConflicts(
  extraction: InputExtractionResult,
  existingVerifiedFacts: VerifiedInputBundle[] = [],
): InputLayerConflict[] {
  const conflicts: InputLayerConflict[] = [];
  const candidateTaskTitles = extraction.candidates.tasks.map((task) => task.title);

  for (const candidateTime of extraction.candidates.timeConstraints) {
    if (!candidateTime.normalizedAt) continue;

    for (const bundle of existingVerifiedFacts) {
      if (!sharesTask(candidateTaskTitles, bundle)) continue;

      for (const existingTime of bundle.verifiedTimeFacts) {
        if (!existingTime.normalizedAt || existingTime.normalizedAt === candidateTime.normalizedAt) continue;
        if (existingTime.kind !== candidateTime.kind) continue;

        conflicts.push({
          kind: candidateTime.kind === "deadline" ? "deadline-conflict" : "hard-lock-conflict",
          candidateLabel: candidateTaskTitles[0] ?? candidateTime.label,
          candidateTime: candidateTime.normalizedAt,
          existingTime: existingTime.normalizedAt,
          existingBundleId: bundle.id,
        });
      }
    }
  }

  return conflicts;
}

function sharesTask(candidateTaskTitles: string[], bundle: VerifiedInputBundle): boolean {
  return candidateTaskTitles.some((title) => bundle.verifiedTaskFacts.some((fact) => fact.title === title));
}

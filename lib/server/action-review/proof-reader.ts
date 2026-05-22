import type { ProofEventRef, RhythmWindowDays } from "./types";

const excludedSources = new Set<ProofEventRef["source"]>(["rejected-transcript", "unconfirmed-multimodal"]);

export function readProofEvents(
  userId: string,
  windowDays: RhythmWindowDays,
  sourceEvents: readonly ProofEventRef[] = [],
  now = new Date().toISOString(),
): ProofEventRef[] {
  const cutoff = Date.parse(now) - windowDays * 24 * 60 * 60 * 1000;

  return sourceEvents
    .filter((event) => event.userId === userId)
    .filter(isAcceptedProofEvent)
    .filter((event) => Date.parse(event.occurredAt) >= cutoff)
    .slice()
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    .map((event) => ({ ...event }));
}

export function isAcceptedProofEvent(event: ProofEventRef): boolean {
  if (!event.verified) return false;
  if (excludedSources.has(event.source)) return false;
  if (event.type === "transcript-candidate" || event.type === "ocr-candidate") return false;
  return true;
}

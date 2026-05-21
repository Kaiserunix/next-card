import { describe, expect, it } from "vitest";
import { spokenVoiceCorpus } from "@/tests/fixtures/voice-spoken-corpus";
import { normalizeTranscript } from "@/lib/server/voice/normalization-service";
import { evaluateVoicePlanReadiness } from "@/lib/server/voice/readiness-service";

describe("spoken Chinese voice corpus", () => {
  it.each(spokenVoiceCorpus)("$id: $description", (sample) => {
    const normalization = normalizeTranscript(sample.rawTranscript);

    expect(normalization.normalizedText).toBe(sample.expectedNormalizedText);
    expect(normalization.changedTooMuch).toBe(false);

    const readiness = evaluateVoicePlanReadiness({
      normalizedText: normalization.normalizedText,
      confidence: sample.confidence,
      normalizationChangedTooMuch: normalization.changedTooMuch,
    });

    expect(readiness.gate).toBe(sample.expectedGate);
    expect(readiness.reasons).toEqual(sample.expectedReasons);
    expect(readiness.missingInfoChips).toEqual(sample.expectedMissingInfoChips);
  });
});

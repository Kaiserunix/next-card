import { describe, expect, it } from "vitest";
import type { PlanModeRequest, PlanModeProviderOutput } from "@/lib/server/plan-mode/types";
import voiceConfirmed from "@/tests/fixtures/plan-mode/voice-confirmed-calculus-handoff.json";
import manualDictation from "@/tests/fixtures/plan-mode/manual-dictation-assignment-handoff.json";
import textConfirmed from "@/tests/fixtures/plan-mode/text-confirmed-study-handoff.json";
import multimodalConfirmed from "@/tests/fixtures/plan-mode/multimodal-confirmed-timetable-handoff.json";
import invalidVoiceWithoutTranscript from "@/tests/fixtures/plan-mode/invalid-voice-without-transcript-id.json";
import validProviderOutput from "@/tests/fixtures/plan-mode/provider-output-valid-abc.json";
import missingCProviderOutput from "@/tests/fixtures/plan-mode/provider-output-missing-c.json";
import broadCardProviderOutput from "@/tests/fixtures/plan-mode/provider-output-broad-card.json";

const validRequests = [
  voiceConfirmed,
  manualDictation,
  textConfirmed,
  multimodalConfirmed,
] as PlanModeRequest[];

describe("plan mode fixtures", () => {
  it("cover confirmed voice, manual dictation, text, and multimodal sources", () => {
    expect(validRequests.map((fixture) => fixture.source)).toEqual([
      "voice-confirmed",
      "manual-dictation",
      "text-confirmed",
      "multimodal-confirmed",
    ]);

    for (const fixture of validRequests) {
      expect(fixture.planCompilerHandoff.mustGenerateABC).toBe(true);
      expect(fixture.planCompilerHandoff.verifiedInputBundleId).toMatch(/^bundle_/);
      expect(fixture.planCompilerHandoff.userFacingSummary.length).toBeGreaterThan(6);
      expect(fixture.clientContext.timezone).toBe("Asia/Shanghai");
    }
  });

  it("keeps voice traceability explicit", () => {
    expect((voiceConfirmed as PlanModeRequest).confirmedTranscriptId).toBeTruthy();
    expect((invalidVoiceWithoutTranscript as Partial<PlanModeRequest>).confirmedTranscriptId).toBeUndefined();
  });

  it("provides valid and invalid provider outputs for output validation", () => {
    const valid = validProviderOutput as unknown as PlanModeProviderOutput;
    expect(valid.draft.options.map((option) => option.mode)).toEqual(["A", "B", "C"]);
    expect(valid.draft.writes).toEqual({
      deckCommitted: false,
      proofWritten: false,
      remindersCreated: false,
      scheduleQueued: false,
    });

    expect((missingCProviderOutput as unknown as PlanModeProviderOutput).draft.options).toHaveLength(2);
    expect(JSON.stringify(broadCardProviderOutput)).toContain("完成作业");
  });
});

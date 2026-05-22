import { describe, expect, it } from "vitest";
import { PlanModeServiceError } from "@/lib/server/plan-mode/errors";
import { validatePlanModeRequest } from "@/lib/server/plan-mode/request-validation";
import type { PlanModeRequest } from "@/lib/server/plan-mode/types";
import voiceConfirmed from "@/tests/fixtures/plan-mode/voice-confirmed-calculus-handoff.json";
import invalidMissingHandoff from "@/tests/fixtures/plan-mode/invalid-missing-handoff.json";
import invalidVoiceWithoutTranscript from "@/tests/fixtures/plan-mode/invalid-voice-without-transcript-id.json";
import regenerateRequest from "@/tests/fixtures/plan-mode/regenerate-from-previous-draft.json";

describe("validatePlanModeRequest", () => {
  it("accepts a valid voice-confirmed request with a handoff", () => {
    const request = validatePlanModeRequest(voiceConfirmed);

    expect(request.requestId).toBe("pm_req_voice_calculus_001");
    expect(request.planCompilerHandoff.mustGenerateABC).toBe(true);
    expect(request.confirmedTranscriptId).toBe("voice_tx_calculus_confirmed_001");
  });

  it("rejects requests that only carry transcript text without a handoff", () => {
    expect(() => validatePlanModeRequest(invalidMissingHandoff)).toThrow(PlanModeServiceError);
  });

  it("rejects voice-confirmed requests without confirmedTranscriptId", () => {
    expect(() => validatePlanModeRequest(invalidVoiceWithoutTranscript)).toThrow(
      /confirmedTranscriptId is required/,
    );
  });

  it("rejects regenerate without previousPlanModeDraftId", () => {
    const request = { ...(regenerateRequest as PlanModeRequest), previousPlanModeDraftId: undefined };

    expect(() => validatePlanModeRequest(request)).toThrow(/previousPlanModeDraftId is required/);
  });

  it("rejects handoffs that do not require explicit A/B/C plan mode", () => {
    const request = structuredClone(voiceConfirmed) as PlanModeRequest;
    (request.planCompilerHandoff as unknown as { mustGenerateABC: boolean }).mustGenerateABC = false;

    expect(() => validatePlanModeRequest(request)).toThrow(/mustGenerateABC/);
  });

  it("rejects requests without timezone", () => {
    const request = structuredClone(voiceConfirmed) as PlanModeRequest;
    request.clientContext.timezone = "";

    expect(() => validatePlanModeRequest(request)).toThrow(/timezone is required/);
  });
});

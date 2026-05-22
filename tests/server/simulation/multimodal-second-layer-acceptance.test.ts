import { describe, expect, it } from "vitest";

import {
  buildSecondLayerAcceptanceViewModel,
  runSecondLayerAcceptanceSimulation,
  simulateMultimodalModelSubagents,
} from "@/lib/server/simulation/multimodal-second-layer-acceptance";

describe("multimodal model subagent simulation and second-layer acceptance", () => {
  it("keeps multimodal model subagents inside the input-layer candidate boundary", () => {
    const report = simulateMultimodalModelSubagents();

    expect(report.runs.map((run) => run.id)).toEqual([
      "timetable-image",
      "low-confidence-timetable-row",
      "pdf-assignment",
      "multi-deadline-pdf",
      "notification-relative-date",
      "conflicting-deadline",
      "manual-dictation",
      "prompt-like-document",
    ]);
    expect(report.metrics.totalRuns).toBe(8);
    expect(report.metrics.strictReviewRuns).toBeGreaterThanOrEqual(6);
    expect(report.metrics.blockedRuns).toBe(1);
    expect(report.metrics.planCompilerHandoffs).toBe(1);

    const timetable = report.runs.find((run) => run.id === "timetable-image")!;
    expect(timetable.rawInput.sourceType).toBe("image");
    expect(timetable.extraction.candidates.courses.length).toBeGreaterThanOrEqual(5);
    expect(timetable.extraction.evidence.some((item) => item.boundingBox && item.quote?.includes("高数"))).toBe(true);
    expect(timetable.reviewDecision.requirement).toBe("strict");
    expect(timetable.reviewDecision.confirmationRequest.canProceedToPlanMode).toBe(false);

    const lowConfidence = report.runs.find((run) => run.id === "low-confidence-timetable-row")!;
    expect(lowConfidence.extraction.candidates.timeConstraints[0]?.confidence).toBeLessThan(0.5);
    expect(lowConfidence.reviewDecision.reasons).toContain("low_confidence_time");
    expect(lowConfidence.secondLayerProbe.acceptedByTimeGuardian).toBe(false);

    const manualDictation = report.runs.find((run) => run.id === "manual-dictation")!;
    expect(manualDictation.rawInput.sourceType).toBe("manual-dictation");
    expect(manualDictation.reviewDecision.requirement).toBe("light");
    expect(manualDictation.confirmationResult?.nextAction).toBe("send-to-plan-compiler");
    expect(manualDictation.confirmationResult?.planCompilerHandoff?.mustGenerateABC).toBe(true);

    const promptLike = report.runs.find((run) => run.id === "prompt-like-document")!;
    expect(promptLike.reviewDecision.requirement).toBe("blocked");
    expect(promptLike.secondLayerProbe.acceptedByTimeGuardian).toBe(false);

    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(
      /selectedPlan|chosenPlanId|committedDeck|cardState|reminderJob|proofRecord|profileSnapshot|TimeLock/,
    );
  });

  it("lets the second-layer agent accept only validated post-plan queue actions", () => {
    const report = runSecondLayerAcceptanceSimulation();

    expect(report.metrics.rawMultimodalRuns).toBe(8);
    expect(report.metrics.rawRunsAcceptedByTimeGuardian).toBe(0);
    expect(report.metrics.acceptedQueueActions).toBeGreaterThanOrEqual(8);
    expect(report.metrics.rejectedQueueActions).toBeGreaterThanOrEqual(3);
    expect(report.metrics.forbiddenWritesBlocked).toBe(2);
    expect(report.metrics.baselineReminderIntegrity).toBe(true);
    expect(report.metrics.directProofWrites).toBe(0);
    expect(report.metrics.directProfileWrites).toBe(0);

    expect(report.rawRunDecisions.every((decision) => decision.acceptance !== "accepted")).toBe(true);
    expect(report.queueActionDecisions.filter((decision) => decision.acceptance === "accepted").length).toBe(
      report.metrics.acceptedQueueActions,
    );
    expect(report.queueActionDecisions.some((decision) => decision.reason.includes("chosen plan"))).toBe(true);
    expect(report.queueActionDecisions.some((decision) => decision.reason.includes("protected time lock"))).toBe(true);
    expect(report.queueActionDecisions.some((decision) => decision.reason.includes("baseline reminder"))).toBe(true);
    expect(report.forbiddenWriteDecisions.map((decision) => decision.kind)).toEqual(["proofRecord", "profileSnapshot"]);
  });

  it("builds a compact view model for second-layer acceptance visualization", () => {
    const viewModel = buildSecondLayerAcceptanceViewModel(runSecondLayerAcceptanceSimulation());

    expect(viewModel.agentTracks.map((track) => track.id)).toEqual([
      "multimodal-model",
      "input-review-gate",
      "plan-mode-boundary",
      "time-guardian-acceptance",
    ]);
    expect(viewModel.acceptanceRows.length).toBeGreaterThan(10);
    expect(viewModel.acceptanceRows.some((row) => row.status === "rejected")).toBe(true);
    expect(viewModel.acceptanceRows.some((row) => row.status === "accepted")).toBe(true);
    expect(viewModel.guardrailSummary).toContain("0 个 raw multimodal 输出被第二层直接接收");
  });
});

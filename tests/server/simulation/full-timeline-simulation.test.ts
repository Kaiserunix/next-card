import { describe, expect, it } from "vitest";

import { runReviewGate } from "@/lib/server/input-layer/review-gate";
import type { InputExtractionResult, RawInput } from "@/lib/server/input-layer/types";
import {
  buildSimulationViewModel,
  runFullTimelineSimulation,
  simulateOcrCourseAndTaskModel,
  simulatePlanningModel,
} from "@/lib/server/simulation/full-timeline-simulation";
import { validateQueueAction } from "@/lib/server/time-guardian/queue-action-validator";
import { rangesOverlap } from "@/lib/server/time-guardian/time-overlap";

describe("full timeline simulation", () => {
  it("simulates OCR and large-model workers over a crowded student schedule", () => {
    const ocrOutput = simulateOcrCourseAndTaskModel();
    const planningOutput = simulatePlanningModel(ocrOutput);

    expect(ocrOutput.courses.length).toBeGreaterThanOrEqual(6);
    expect(ocrOutput.tasks.length).toBeGreaterThanOrEqual(12);
    expect(ocrOutput.unverifiedCandidates.some((candidate) => candidate.source === "ocr")).toBe(true);
    expect(planningOutput.decks.length).toBeGreaterThanOrEqual(4);
    expect(planningOutput.cards.every((card) => card.chosenPlanId === "plan-b")).toBe(true);
  });

  it("runs a deterministic Time Guardian timeline without inventing hard locks from weak OCR", () => {
    const report = runFullTimelineSimulation();

    expect(report.metrics.coursesParsed).toBeGreaterThanOrEqual(6);
    expect(report.metrics.tasksParsed).toBeGreaterThanOrEqual(12);
    expect(report.metrics.decksCommitted).toBeGreaterThanOrEqual(4);
    expect(report.metrics.cardsScheduled).toBeGreaterThanOrEqual(4);
    expect(report.metrics.baselineReminders).toBe(report.metrics.timeProtectedCards);
    expect(report.metrics.inAppOnlyReminders).toBe(report.metrics.baselineReminders);
    expect(report.metrics.blockedUnverifiedHardLocks).toBeGreaterThanOrEqual(1);
    expect(report.metrics.directProofWrites).toBe(0);
    expect(report.metrics.directProfileWrites).toBe(0);
    expect(report.timelineEvents.length).toBeGreaterThan(12);
    expect(report.timelineEvents.map((event) => event.at)).toEqual([...report.timelineEvents.map((event) => event.at)].sort());
    expect(report.queueActions.every((action) => action.snapshotId === report.snapshot.id)).toBe(true);
    expect(report.timelineEvents.some((event) => event.kind === "freeze-return")).toBe(true);
    expect(report.timelineEvents.some((event) => event.kind === "deadline-warning")).toBe(true);
  });

  it("keeps simulated model output behind review, queue, and hard-lock gates", () => {
    const report = runFullTimelineSimulation();

    expect(report.ocrOutput.unverifiedCandidates.every((candidate) => {
      return !report.snapshot.timeLocks.some((lock) => lock.id.includes(candidate.id) || lock.sourceRefs.some((ref) => ref.rawInputId.includes(candidate.id)));
    })).toBe(true);
    expect(report.ocrOutput.courses.filter((course) => course.confidence < 0.85).every((course) => !course.verified)).toBe(true);

    const review = runReviewGate({
      rawInput: raw("image", "疑似 07:30 体育课，图片模糊"),
      extraction: extraction({
        warnings: ["high_risk_multimodal", "low_confidence_time", "course_time", "table_parse_result"],
        timeConstraints: [
          {
            id: "time_uncertain_pe",
            kind: "hard-lock",
            label: "疑似 07:30 体育课",
            isHard: true,
            confidence: 0.42,
          },
        ],
      }),
    });
    expect(review.requirement).toBe("strict");
    expect(review.confirmationRequest.canProceedToPlanMode).toBe(false);

    for (const action of report.queueActions) {
      const validation = validateQueueAction(action, {
        snapshot: report.snapshot,
        expectedChosenPlanId: "plan-b",
        notificationCapability: "in_app_only",
      });
      expect([action.type, validation.allowed, validation.reason]).toEqual([action.type, true, validation.reason]);

      if (action.type === "create-baseline-reminder") {
        expect(["system-fallback", "user-fixed"]).toContain(action.reminder.source);
      }
      if (action.type === "create-nudge-reminder") {
        expect(action.removesReminderIds ?? []).toHaveLength(0);
      }
      if (action.type === "insert-schedule-event" && action.event.startsAt && action.event.endsAt) {
        const conflictingLock = report.snapshot.timeLocks.find((lock) => {
          return lock.startAt && lock.endAt && rangesOverlap(action.event.startsAt!, action.event.endsAt!, lock.startAt, lock.endAt);
        });
        expect(conflictingLock?.id).toBeUndefined();
      }
      if (action.type === "emit-deadline-warning") {
        expect(action.warning.suggestedRecoveryOptions.map((option) => option.kind as string)).not.toContain("delete-goal");
      }
    }

    const serialized = JSON.stringify({ actions: report.queueActions, timeline: report.timelineEvents });
    expect(serialized).not.toMatch(/profileSnapshot|appendProof|committedDeckWrite/);
  });

  it("builds a visualization view model with input/deck/proof modes and agent tracks", () => {
    const viewModel = buildSimulationViewModel(runFullTimelineSimulation());

    expect(viewModel.topModes).toEqual(["input", "deck", "proof"]);
    expect(viewModel.agentTracks.map((track) => track.id)).toEqual([
      "ocr-worker",
      "planning-worker",
      "deck-commit",
      "time-guardian",
      "proof-ledger",
      "proof-audit",
    ]);
    expect(viewModel.timelineRows.length).toBeGreaterThan(12);
    expect(viewModel.unfinishedItems.some((item) => item.status === "not-started")).toBe(true);
  });
});

function raw(sourceType: RawInput["sourceType"], text: string): RawInput {
  return {
    id: `raw_${sourceType}`,
    sourceType,
    text,
    sourceHash: "f".repeat(64),
    locale: "zh-CN",
    createdAt: "2026-05-21T07:00:00.000Z",
    receivedAt: "2026-05-21T07:00:00.000Z",
    privacyFlags: [],
    retentionPolicy: {
      rawRetentionDays: 7,
      derivedRetentionDays: 30,
      userDeletable: true,
    },
  };
}

function extraction(
  overrides: Partial<InputExtractionResult> & {
    timeConstraints?: InputExtractionResult["candidates"]["timeConstraints"];
  },
): InputExtractionResult {
  return {
    id: "extract_sim",
    rawInputId: "raw_image",
    candidates: {
      tasks: [
        {
          id: "task_uncertain_pe",
          title: "疑似体育课",
          taskType: "course-arrival",
          confidence: 0.42,
          lifecycle: "unknown",
        },
      ],
      timeConstraints: overrides.timeConstraints ?? [],
      locations: [],
      courses: [],
      reminders: [],
    },
    confidence: overrides.confidence ?? 0.42,
    ambiguities: overrides.ambiguities ?? ["图片模糊，课程时间不确定"],
    warnings: overrides.warnings ?? [],
    evidence: overrides.evidence ?? [{ rawInputId: "raw_image", quote: "疑似 07:30 体育课", confidence: 0.42 }],
    reviewRequirement: overrides.reviewRequirement ?? "strict",
  };
}

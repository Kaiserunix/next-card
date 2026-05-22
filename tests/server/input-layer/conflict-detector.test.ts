import { describe, expect, it } from "vitest";
import { detectTimeConflicts } from "@/lib/server/input-layer/conflict-detector";
import type { InputExtractionResult, VerifiedInputBundle } from "@/lib/server/input-layer/types";

describe("detectTimeConflicts", () => {
  it("detects conflicting deadlines for the same task label", () => {
    const conflicts = detectTimeConflicts(extraction("英语作文", "2026-05-22T12:00:00.000+08:00"), [
      bundle("英语作文", "2026-05-22T20:00:00.000+08:00"),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      kind: "deadline-conflict",
      candidateLabel: "英语作文",
    });
  });

  it("does not flag matching verified deadlines", () => {
    const conflicts = detectTimeConflicts(extraction("英语作文", "2026-05-22T20:00:00.000+08:00"), [
      bundle("英语作文", "2026-05-22T20:00:00.000+08:00"),
    ]);

    expect(conflicts).toEqual([]);
  });
});

function extraction(taskTitle: string, normalizedAt: string): InputExtractionResult {
  return {
    id: "extract_1",
    rawInputId: "raw_1",
    candidates: {
      tasks: [{ id: "task_1", title: taskTitle, taskType: "assignment", confidence: 0.9, lifecycle: "one-off" }],
      timeConstraints: [{ id: "time_1", kind: "deadline", label: "DDL", normalizedAt, isHard: true, confidence: 0.9 }],
      locations: [],
      courses: [],
      reminders: [],
    },
    confidence: 0.9,
    ambiguities: [],
    warnings: [],
    evidence: [{ rawInputId: "raw_1", quote: "DDL", confidence: 0.9 }],
    reviewRequirement: "light",
  };
}

function bundle(taskTitle: string, normalizedAt: string): VerifiedInputBundle {
  return {
    id: "bundle_1",
    rawInputId: "raw_existing",
    verifiedTaskFacts: [{ id: "fact_task_1", title: taskTitle, taskType: "assignment", confidence: 1 }],
    verifiedTimeFacts: [{ id: "fact_time_1", kind: "deadline", label: "DDL", normalizedAt, isHard: true, confidence: 1 }],
    verifiedLocationFacts: [],
    lifecycle: "one-off",
    tensionLevel: "hard",
    confirmationStatus: "confirmed",
    evidenceRefs: [{ rawInputId: "raw_existing", quote: "DDL", confidence: 1 }],
    readyForPlanCompiler: true,
  };
}

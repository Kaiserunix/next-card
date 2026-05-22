import { describe, expect, it } from "vitest";
import { createPlanCompilerHandoff } from "@/lib/server/input-layer/plan-handoff-service";
import type { VerifiedInputBundle } from "@/lib/server/input-layer/types";

describe("createPlanCompilerHandoff", () => {
  it("returns verified facts, constraints, assumptions, and non-blocking gaps only", () => {
    const handoff = createPlanCompilerHandoff(bundle());

    expect(handoff).toMatchObject({
      verifiedInputBundleId: "bundle_1",
      sourceType: "text",
      mustGenerateABC: true,
    });
    expect(handoff.constraints).toEqual(expect.arrayContaining(["deadline: 今晚八点前"]));
    expect(handoff.assumptions).toContain("lifecycle: one-off");
    expect(handoff.missingButNonBlocking).toContain("location");
    expect(Object.keys(handoff)).not.toEqual(expect.arrayContaining(["selectedPlan", "committedDeck", "proofRecord"]));
  });

  it("refuses bundles that are not ready for the Plan Compiler", () => {
    expect(() => createPlanCompilerHandoff({ ...bundle(), readyForPlanCompiler: false })).toThrow(
      /not ready for Plan Compiler/,
    );
  });
});

function bundle(): VerifiedInputBundle {
  return {
    id: "bundle_1",
    rawInputId: "raw_1",
    sourceType: "text",
    verifiedTaskFacts: [{ id: "task_1", title: "交英语作文", taskType: "assignment", confidence: 1 }],
    verifiedTimeFacts: [{ id: "time_1", kind: "deadline", label: "今晚八点前", isHard: true, confidence: 1 }],
    verifiedLocationFacts: [],
    lifecycle: "one-off",
    tensionLevel: "hard",
    confirmationStatus: "confirmed",
    evidenceRefs: [{ rawInputId: "raw_1", quote: "今晚八点前", confidence: 1 }],
    readyForPlanCompiler: true,
    missingButNonBlocking: ["location"],
  };
}

import { compareIso } from "./time-overlap";
import type { SoftTaskTiming, TaskTension } from "./types";

export type SoftTaskGoodLinePhase = "optional" | "gentle-nudge" | "must-nudge" | "hardened";

export type SoftTaskGoodLineResult = {
  phase: SoftTaskGoodLinePhase;
  nextTension: TaskTension;
  reason: string;
};

export function evaluateSoftTaskGoodLine(input: {
  now: string;
  timing: SoftTaskTiming;
}): SoftTaskGoodLineResult {
  const { now, timing } = input;

  if (timing.hardensAt && compareIso(now, timing.hardensAt) >= 0) {
    return {
      phase: "hardened",
      nextTension: "deadline-sensitive",
      reason: `Soft task passed hardensAt ${timing.hardensAt}. ${timing.reason}`,
    };
  }

  if (timing.mustNudgeAfterAt && compareIso(now, timing.mustNudgeAfterAt) >= 0) {
    return {
      phase: "must-nudge",
      nextTension: "recommended",
      reason: `Soft task passed mustNudgeAfterAt ${timing.mustNudgeAfterAt}. ${timing.reason}`,
    };
  }

  if (timing.recommendedGoodLineAt && compareIso(now, timing.recommendedGoodLineAt) >= 0) {
    return {
      phase: "gentle-nudge",
      nextTension: "recommended",
      reason: `Soft task reached recommendedGoodLineAt ${timing.recommendedGoodLineAt}. ${timing.reason}`,
    };
  }

  return {
    phase: "optional",
    nextTension: "soft",
    reason: `Soft task remains optional before recommended good line. ${timing.reason}`,
  };
}

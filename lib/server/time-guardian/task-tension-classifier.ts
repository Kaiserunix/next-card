import { evaluateSoftTaskGoodLine } from "./soft-task-good-line";
import type { SoftTaskTiming, TaskTension, TimeLockKind } from "./types";

export type ClassifyTaskTensionInput = {
  now: string;
  timeLockKind?: TimeLockKind;
  softTaskTiming?: SoftTaskTiming;
  generatedBy?: "input-organizing" | "time-guardian" | "action-review" | "user";
  hasDeadline?: boolean;
  slackMinutes?: number;
};

export type TaskTensionClassification = {
  tension: TaskTension;
  reason: string;
};

export function classifyTaskTension(input: ClassifyTaskTensionInput): TaskTensionClassification {
  if (input.timeLockKind) {
    return {
      tension: "hard",
      reason: `${input.timeLockKind} is a verified hard time constraint.`,
    };
  }

  if (input.softTaskTiming) {
    const goodLine = evaluateSoftTaskGoodLine({ now: input.now, timing: input.softTaskTiming });
    return {
      tension: goodLine.nextTension,
      reason: goodLine.reason,
    };
  }

  if (input.hasDeadline && typeof input.slackMinutes === "number" && input.slackMinutes <= 30) {
    return {
      tension: "deadline-sensitive",
      reason: "Deadline exists and slack is narrowing.",
    };
  }

  if (input.generatedBy === "action-review") {
    return {
      tension: "soft",
      reason: "System-generated support task starts as optional soft work.",
    };
  }

  return {
    tension: "unknown",
    reason: "Task needs review before assigning scheduling tension.",
  };
}

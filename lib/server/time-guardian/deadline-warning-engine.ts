import { calculateDeadlineSlackMinutes, type FixedBusyWindow } from "./slack-calculator";
import type { DeadlineWarning, DeadlineWarningLevel, RecoveryOption } from "./types";

export type EvaluateDeadlineWarningInput = {
  now: string;
  dueAt: string;
  remainingEstimatedMinutes: number;
  fixedBusyWindows: FixedBusyWindow[];
  safetyBufferMinutes: number;
  affectedCardIds: string[];
  estimateConfidence: number;
};

export function evaluateDeadlineWarning(input: EvaluateDeadlineWarningInput): DeadlineWarning {
  const slack = calculateDeadlineSlackMinutes(input);
  const level = getWarningLevel(slack.slackMinutes, input.remainingEstimatedMinutes, input.estimateConfidence);

  return {
    level,
    reason: buildReason(level, slack.slackMinutes, slack.availableMinutes, input.remainingEstimatedMinutes),
    affectedCardIds: input.affectedCardIds,
    suggestedRecoveryOptions: level === "none" ? [] : createRecoveryOptions(level),
  };
}

function getWarningLevel(slackMinutes: number, remainingEstimatedMinutes: number, estimateConfidence: number): DeadlineWarningLevel {
  const confidencePenalty = estimateConfidence < 0.7 ? 10 : 0;
  const adjustedSlack = slackMinutes - confidencePenalty;

  if (adjustedSlack < 0) return "critical";
  if (adjustedSlack <= Math.max(15, remainingEstimatedMinutes * 0.2)) return "risk";
  if (adjustedSlack <= Math.max(30, remainingEstimatedMinutes * 0.5)) return "watch";
  return "none";
}

function buildReason(
  level: DeadlineWarningLevel,
  slackMinutes: number,
  availableMinutes: number,
  remainingEstimatedMinutes: number,
): string {
  if (level === "none") {
    return `Available ${availableMinutes} minutes leaves enough slack for ${remainingEstimatedMinutes} minutes of work.`;
  }
  return `Deadline slack is ${slackMinutes} minutes after fixed busy time and safety buffer.`;
}

function createRecoveryOptions(level: Exclude<DeadlineWarningLevel, "none">): RecoveryOption[] {
  return [
    {
      id: `${level}_shrink_progress`,
      kind: "shrink-progress-goal",
      label: "Make the next progress step smaller",
      reason: "Only the progress step may shrink; baseline and standard goals remain intact.",
    },
    {
      id: `${level}_reschedule`,
      kind: "reschedule",
      label: "Ask for a safer recovery window",
      reason: "Time Guardian needs user review before changing a risky schedule.",
    },
  ];
}

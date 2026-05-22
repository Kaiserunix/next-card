import type { DeadlineWarning, GoalContract, RequestUserReviewAction, ScheduleSnapshot } from "./types";

export function createRecoveryReviewAction(input: {
  snapshot: ScheduleSnapshot;
  warning: DeadlineWarning;
  goalContract: GoalContract;
  createdAt: string;
}): RequestUserReviewAction {
  return {
    type: "request-user-review",
    id: `action_recovery_review_${input.goalContract.deckId}`,
    snapshotId: input.snapshot.id,
    actor: "system-service",
    reason: `Deadline warning requires user review: ${input.warning.reason}`,
    createdAt: input.createdAt,
    reviewReason:
      "Deadline pressure changed; choose a smaller progress step or a safer time without reducing baseline or standard goals.",
    affectedCardIds: input.warning.affectedCardIds,
    recoveryOptions: input.warning.suggestedRecoveryOptions.filter((option) => option.kind !== "keep-frozen"),
  };
}

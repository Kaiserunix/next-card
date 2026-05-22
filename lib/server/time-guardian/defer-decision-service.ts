import { validateScheduleWindowAgainstTimeLocks } from "./time-lock-validator";
import type { CommittedCardRef, DeferCardAction, RequestUserReviewAction, ScheduleSnapshot, TimeWindow } from "./types";

export type DeferDecisionResult = {
  action: DeferCardAction | RequestUserReviewAction;
  reason: string;
};

export function decideDeferCard(input: {
  snapshot: ScheduleSnapshot;
  card: CommittedCardRef;
  toWindow: TimeWindow;
  fromWindow?: TimeWindow;
}): DeferDecisionResult {
  const validation = validateScheduleWindowAgainstTimeLocks({
    snapshot: input.snapshot,
    window: {
      startsAt: input.toWindow.startAt,
      endsAt: input.toWindow.endAt,
    },
    deadlineAt: input.card.deadlineAt,
  });

  if (!validation.allowed) {
    return {
      reason: validation.reason,
      action: {
        type: "request-user-review",
        id: `action_review_defer_${input.card.cardId}`,
        snapshotId: input.snapshot.id,
        actor: "system-service",
        reason: validation.reason,
        createdAt: input.snapshot.now,
        chosenPlanId: input.card.chosenPlanId,
        reviewReason: validation.reason,
        affectedCardIds: [input.card.cardId],
        recoveryOptions: [
          {
            id: "choose_another_window",
            kind: "reschedule",
            label: "Choose another window",
            reason: "The requested defer would collide with protected time.",
          },
        ],
      },
    };
  }

  return {
    reason: validation.reason,
    action: {
      type: "defer-card",
      id: `action_defer_${input.card.cardId}`,
      snapshotId: input.snapshot.id,
      actor: "user",
      reason: "User requested a safe defer window.",
      createdAt: input.snapshot.now,
      chosenPlanId: input.card.chosenPlanId,
      cardId: input.card.cardId,
      deckId: input.card.deckId,
      fromWindow: input.fromWindow,
      toWindow: input.toWindow,
      deadlineAt: input.card.deadlineAt,
    },
  };
}

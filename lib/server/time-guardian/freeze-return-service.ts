import { planCardWindows } from "./card-window-planner";
import { chooseFrozenQueuePolicy } from "./frozen-queue-policy";
import type { AgentPolicySnapshot, DeadlineWarning, FrozenQueueItem, QueueAction, ScheduleSnapshot } from "./types";

export type PlanFreezeReturnResult = {
  actions: QueueAction[];
  reason: string;
};

export function planFreezeReturn(input: {
  snapshot: ScheduleSnapshot;
  item: FrozenQueueItem;
  createdAt: string;
  deadlineWarning?: DeadlineWarning;
  policySnapshot?: AgentPolicySnapshot;
}): PlanFreezeReturnResult {
  const policy = chooseFrozenQueuePolicy(input);

  if (policy.decision === "needs-review" || policy.decision === "keep-frozen") {
    return {
      reason: policy.reason,
      actions: [
        {
          type: "request-user-review",
          id: `action_freeze_review_${input.item.cardId}`,
          snapshotId: input.snapshot.id,
          actor: "system-service",
          reason: policy.reason,
          createdAt: input.createdAt,
          chosenPlanId: input.item.chosenPlanId,
          reviewReason: policy.reason,
          affectedCardIds: [input.item.cardId],
          recoveryOptions: [
            {
              id: "keep_frozen",
              kind: "keep-frozen",
              label: "Keep this card frozen",
              reason: "Context remains saved until a safer return window exists.",
            },
          ],
        },
      ],
    };
  }

  const planning = planCardWindows({
    snapshot: input.snapshot,
    chosenPlanId: input.item.chosenPlanId,
    cards: [
      {
        cardId: input.item.cardId,
        deckId: input.item.deckId,
        chosenPlanId: input.item.chosenPlanId,
        title: "Return to frozen card",
        tension: input.item.tension ?? "recommended",
        estimatedMinutes: input.item.estimatedMinutes ?? 10,
        deadlineAt: input.item.deadlineAt,
        hardLockRefs: [],
      },
    ],
  });
  const placement = planning.placements[0];

  if (!placement) {
    return {
      reason: planning.conflicts[0]?.reason ?? "No safe window is available for frozen return.",
      actions: [
        {
          type: "request-user-review",
          id: `action_freeze_review_${input.item.cardId}`,
          snapshotId: input.snapshot.id,
          actor: "system-service",
          reason: planning.conflicts[0]?.reason ?? "No safe window is available for frozen return.",
          createdAt: input.createdAt,
          chosenPlanId: input.item.chosenPlanId,
          reviewReason: planning.conflicts[0]?.reason ?? "No safe window is available.",
          affectedCardIds: [input.item.cardId],
          recoveryOptions: [
            {
              id: "choose_return_window",
              kind: "reschedule",
              label: "Choose a safer return window",
              reason: "Frozen cards must return through hard-lock validation.",
            },
          ],
        },
      ],
    };
  }

  return {
    reason: policy.reason,
    actions: [
      {
        type: "reinsert-frozen-card",
        id: `action_reinsert_${input.item.cardId}`,
        snapshotId: input.snapshot.id,
        actor: "system-service",
        reason: "Reinsert frozen card after Time Guardian review.",
        createdAt: input.createdAt,
        chosenPlanId: input.item.chosenPlanId,
        frozenItemId: input.item.id,
        cardId: input.item.cardId,
        deckId: input.item.deckId,
        window: placement.window,
      },
      {
        type: "insert-schedule-event",
        id: `action_freeze_return_event_${input.item.cardId}`,
        snapshotId: input.snapshot.id,
        actor: "system-service",
        reason: "Insert internal freeze-return event.",
        createdAt: input.createdAt,
        chosenPlanId: input.item.chosenPlanId,
        idempotencyKey: `${input.item.deckId}:${input.item.cardId}:freeze-return:${placement.window.startAt}`,
        event: {
          id: `event_freeze_return_${input.item.cardId}`,
          userId: "anon",
          kind: "freeze-return",
          deckId: input.item.deckId,
          cardId: input.item.cardId,
          chosenPlanId: input.item.chosenPlanId,
          startsAt: placement.window.startAt,
          endsAt: placement.window.endAt,
          timezone: placement.window.timezone,
          source: "time-guardian",
          status: "planned",
          basedOnSnapshotId: input.snapshot.id,
          sourceRefs: [],
          reason: "Frozen card returned without deleting task context.",
        },
      },
    ],
  };
}

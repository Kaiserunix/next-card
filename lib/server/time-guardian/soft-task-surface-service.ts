import { evaluateSoftTaskGoodLine } from "./soft-task-good-line";
import { planCardWindows } from "./card-window-planner";
import type { CommittedCardRef, QueueAction, ScheduleSnapshot, SoftTaskTiming } from "./types";

export type CreateSoftTaskSurfaceActionsResult = {
  actions: QueueAction[];
  userVisibleCopy: string;
};

export function createSoftTaskSurfaceActions(input: {
  snapshot: ScheduleSnapshot;
  card: CommittedCardRef;
  timing: SoftTaskTiming;
  createdAt: string;
}): CreateSoftTaskSurfaceActionsResult {
  const goodLine = evaluateSoftTaskGoodLine({ now: input.snapshot.now, timing: input.timing });
  if (goodLine.phase === "optional") {
    return {
      actions: [],
      userVisibleCopy: "This card is still optional before its recommended action line.",
    };
  }

  const planning = planCardWindows({
    snapshot: input.snapshot,
    cards: [{ ...input.card, tension: goodLine.nextTension }],
    chosenPlanId: input.card.chosenPlanId,
  });

  const actions: QueueAction[] = [
    {
      type: "update-soft-task-tension",
      id: `action_soft_tension_${input.card.cardId}`,
      snapshotId: input.snapshot.id,
      actor: "system-service",
      reason: goodLine.reason,
      createdAt: input.createdAt,
      chosenPlanId: input.card.chosenPlanId,
      cardId: input.card.cardId,
      deckId: input.card.deckId,
      from: input.card.tension,
      to: goodLine.nextTension,
      timing: input.timing,
      userVisibleCopy: "This card is becoming timely; you can still choose when to continue.",
    },
  ];

  const placement = planning.placements[0];
  if (placement) {
    actions.push({
      type: "insert-schedule-event",
      id: `action_soft_surface_${input.card.cardId}`,
      snapshotId: input.snapshot.id,
      actor: "system-service",
      reason: "Surface a soft task in an available safe window.",
      createdAt: input.createdAt,
      chosenPlanId: input.card.chosenPlanId,
      idempotencyKey: `${input.card.deckId}:${input.card.cardId}:soft-surface:${placement.window.startAt}`,
      event: {
        id: `event_soft_surface_${input.card.cardId}`,
        userId: "anon",
        kind: goodLine.phase === "hardened" ? "soft-task-harden" : "soft-task-surface",
        deckId: input.card.deckId,
        cardId: input.card.cardId,
        chosenPlanId: input.card.chosenPlanId,
        startsAt: placement.window.startAt,
        endsAt: placement.window.endAt,
        timezone: placement.window.timezone,
        source: "time-guardian",
        status: "planned",
        basedOnSnapshotId: input.snapshot.id,
        sourceRefs: [],
        reason: goodLine.reason,
      },
    });
  } else {
    actions.push({
      type: "request-user-review",
      id: `action_soft_review_${input.card.cardId}`,
      snapshotId: input.snapshot.id,
      actor: "system-service",
      reason: planning.conflicts[0]?.reason ?? "No safe window is available for soft task surfacing.",
      createdAt: input.createdAt,
      chosenPlanId: input.card.chosenPlanId,
      reviewReason: planning.conflicts[0]?.reason ?? "No safe window is available.",
      affectedCardIds: [input.card.cardId],
      recoveryOptions: [
        {
          id: "keep_soft_for_later",
          kind: "reschedule",
          label: "Keep this card for a later safe window",
          reason: "Soft tasks must not occupy user locked time or hard locks.",
        },
      ],
    });
  }

  return {
    actions,
    userVisibleCopy: "This card is becoming timely; choose a calm moment to continue.",
  };
}

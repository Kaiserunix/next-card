import { planCardWindows, type CardWindowPlacement } from "./card-window-planner";
import type {
  AgentPolicySnapshot,
  CommittedCardRef,
  CommittedDeckRef,
  QueueAction,
  ScheduleSnapshot,
} from "./types";

export type ScheduleProposal = {
  deckId: string;
  chosenPlanId: string;
  placements: CardWindowPlacement[];
  conflicts: Array<{ cardId: string; reason: string }>;
};

export type ScheduleCommittedDeckInput = {
  snapshot: ScheduleSnapshot;
  deck: CommittedDeckRef;
  cards: CommittedCardRef[];
  chosenPlanId: string;
  policySnapshot?: AgentPolicySnapshot;
};

export type ScheduleCommittedDeckResult = {
  scheduleProposal: ScheduleProposal;
  queueActions: QueueAction[];
  warnings: string[];
};

export function scheduleCommittedDeck(input: ScheduleCommittedDeckInput): ScheduleCommittedDeckResult {
  const planning = planCardWindows({
    snapshot: input.snapshot,
    cards: input.cards,
    chosenPlanId: input.chosenPlanId,
  });

  const queueActions: QueueAction[] = planning.placements.map((placement) => ({
    type: "insert-schedule-event",
    id: `action_insert_${placement.cardId}`,
    snapshotId: input.snapshot.id,
    actor: "system-service",
    reason: `Insert internal card window for selected plan ${input.chosenPlanId}.`,
    createdAt: input.snapshot.now,
    chosenPlanId: input.chosenPlanId,
    idempotencyKey: `${placement.deckId}:${placement.cardId}:card-window:${placement.window.startAt}`,
    event: {
      id: `event_${placement.cardId}_${placement.window.startAt}`,
      userId: "anon",
      kind: "card-window",
      deckId: placement.deckId,
      cardId: placement.cardId,
      chosenPlanId: placement.chosenPlanId,
      startsAt: placement.window.startAt,
      endsAt: placement.window.endAt,
      timezone: placement.window.timezone,
      source: "time-guardian",
      status: "planned",
      basedOnSnapshotId: input.snapshot.id,
      sourceRefs: [],
      reason: `Scheduled by deterministic Time Guardian kernel for ${input.deck.title}.`,
    },
  }));

  if (planning.conflicts.length > 0) {
    queueActions.push({
      type: "request-user-review",
      id: `action_review_${input.deck.deckId}`,
      snapshotId: input.snapshot.id,
      actor: "system-service",
      reason: "No safe window is available for at least one selected card.",
      createdAt: input.snapshot.now,
      chosenPlanId: input.chosenPlanId,
      reviewReason: "No safe window is available without violating protected time.",
      affectedCardIds: planning.conflicts.map((conflict) => conflict.cardId),
      recoveryOptions: [
        {
          id: "review_reschedule",
          kind: "reschedule",
          label: "Ask the user to choose a safer window",
          reason: "Time Guardian cannot silently move hard locks or force a card into a conflict.",
        },
      ],
    });
  }

  return {
    scheduleProposal: {
      deckId: input.deck.deckId,
      chosenPlanId: input.chosenPlanId,
      placements: planning.placements,
      conflicts: planning.conflicts,
    },
    queueActions,
    warnings: planning.conflicts.map((conflict) => `No safe window for ${conflict.cardId}: ${conflict.reason}`),
  };
}

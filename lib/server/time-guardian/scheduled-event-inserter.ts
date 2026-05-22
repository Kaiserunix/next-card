import { validateQueueAction, type ValidateQueueActionOptions } from "./queue-action-validator";
import { rangesOverlap } from "./time-overlap";
import type { InsertScheduleEventAction, ScheduledEvent, ScheduleSnapshot } from "./types";

export type InsertScheduledEventResult = {
  inserted: boolean;
  reason: string;
  snapshot: ScheduleSnapshot;
};

export function insertScheduledEvent(
  snapshot: ScheduleSnapshot,
  action: InsertScheduleEventAction,
  options: Omit<ValidateQueueActionOptions, "snapshot">,
): InsertScheduledEventResult {
  const validation = validateQueueAction(action, {
    ...options,
    snapshot,
  });
  if (!validation.allowed) {
    return {
      inserted: false,
      reason: validation.reason,
      snapshot,
    };
  }

  if (snapshot.scheduledEvents.some((event) => sameScheduledEvent(event, action.event))) {
    return {
      inserted: false,
      reason: "Duplicate schedule event idempotency key.",
      snapshot,
    };
  }

  const overlap = findExistingTimelineOverlap(snapshot, action.event);
  if (overlap) {
    return {
      inserted: false,
      reason: overlap.reason,
      snapshot,
    };
  }

  return {
    inserted: true,
    reason: "Inserted internal scheduled event.",
    snapshot: {
      ...snapshot,
      scheduledEvents: [...snapshot.scheduledEvents, { ...action.event, status: "inserted" }],
    },
  };
}

function findExistingTimelineOverlap(
  snapshot: ScheduleSnapshot,
  event: ScheduledEvent,
): { reason: string } | null {
  if (!event.startsAt || !event.endsAt || event.status === "cancelled") return null;

  const existingEvent = snapshot.scheduledEvents.find((scheduledEvent) => {
    return (
      scheduledEvent.status !== "cancelled" &&
      scheduledEvent.startsAt &&
      scheduledEvent.endsAt &&
      rangesOverlap(event.startsAt!, event.endsAt!, scheduledEvent.startsAt, scheduledEvent.endsAt)
    );
  });
  if (existingEvent) {
    return {
      reason: `Inserted event ${event.id} overlaps existing scheduled event ${existingEvent.id}.`,
    };
  }

  const activeCard = snapshot.activeCards.find((card) => {
    return (
      card.scheduledWindow &&
      rangesOverlap(event.startsAt!, event.endsAt!, card.scheduledWindow.startAt, card.scheduledWindow.endAt)
    );
  });
  if (activeCard) {
    return {
      reason: `Inserted event ${event.id} overlaps active scheduled card ${activeCard.cardId}.`,
    };
  }

  return null;
}

function sameScheduledEvent(left: ScheduledEvent, right: ScheduledEvent): boolean {
  if (left.id === right.id) return true;
  return (
    left.kind === right.kind &&
    left.deckId === right.deckId &&
    left.cardId === right.cardId &&
    left.chosenPlanId === right.chosenPlanId &&
    left.startsAt === right.startsAt &&
    left.endsAt === right.endsAt &&
    left.fireAt === right.fireAt
  );
}

import { canScheduleExternalReminder } from "./notification-capability";
import { validateScheduleWindowAgainstTimeLocks } from "./time-lock-validator";
import { rangesOverlap } from "./time-overlap";
import type { NotificationCapability, QueueAction, ScheduleSnapshot, TimeLock } from "./types";

export type QueueActionValidationResult =
  | { allowed: true; reason: string; action: QueueAction }
  | {
      allowed: false;
      reason: string;
      conflictLockIds?: string[];
      requiresUserReview: boolean;
    };

export type ValidateQueueActionOptions = {
  snapshot: ScheduleSnapshot;
  expectedChosenPlanId?: string;
  notificationCapability: NotificationCapability;
};

export function validateQueueAction(
  action: QueueAction,
  options: ValidateQueueActionOptions,
): QueueActionValidationResult {
  const base = validateBase(action, options.snapshot);
  if (!base.allowed) return base;

  const actionPlanId = getActionChosenPlanId(action);
  if (options.expectedChosenPlanId && actionPlanId && actionPlanId !== options.expectedChosenPlanId) {
    return {
      allowed: false,
      reason: `QueueAction chosen plan ${actionPlanId} does not match selected chosen plan ${options.expectedChosenPlanId}.`,
      requiresUserReview: true,
    };
  }

  if (action.type === "insert-schedule-event") {
    if (action.event.basedOnSnapshotId !== options.snapshot.id) {
      return {
        allowed: false,
        reason: "Inserted event must be based on the current schedule snapshot.",
        requiresUserReview: true,
      };
    }

    if ((action.event.startsAt && !action.event.endsAt) || (!action.event.startsAt && action.event.endsAt)) {
      return {
        allowed: false,
        reason: "Scheduled event windows must include both startsAt and endsAt.",
        requiresUserReview: true,
      };
    }

    if (action.event.startsAt && action.event.endsAt) {
      const conflict = validateScheduleWindowAgainstTimeLocks({
        snapshot: options.snapshot,
        window: { startsAt: action.event.startsAt, endsAt: action.event.endsAt },
      });
      if (!conflict.allowed) return conflict;

      const timelineOverlap = validateWindowAgainstExistingTimeline(options.snapshot, {
        startsAt: action.event.startsAt,
        endsAt: action.event.endsAt,
      });
      if (!timelineOverlap.allowed) return timelineOverlap;
    }
  }

  if (action.type === "schedule-card") {
    const conflict = validateScheduleWindowAgainstTimeLocks({
      snapshot: options.snapshot,
      window: { startsAt: action.window.startAt, endsAt: action.window.endAt },
    });
    if (!conflict.allowed) return conflict;

    const timelineOverlap = validateWindowAgainstExistingTimeline(options.snapshot, {
      startsAt: action.window.startAt,
      endsAt: action.window.endAt,
    });
    if (!timelineOverlap.allowed) return timelineOverlap;
  }

  if (action.type === "defer-card") {
    const conflict = validateScheduleWindowAgainstTimeLocks({
      snapshot: options.snapshot,
      window: { startsAt: action.toWindow.startAt, endsAt: action.toWindow.endAt },
      deadlineAt: action.deadlineAt,
    });
    if (!conflict.allowed) return conflict;

    const timelineOverlap = validateWindowAgainstExistingTimeline(options.snapshot, {
      startsAt: action.toWindow.startAt,
      endsAt: action.toWindow.endAt,
    });
    if (!timelineOverlap.allowed) return timelineOverlap;
  }

  if (action.type === "freeze-card") {
    const deck = options.snapshot.committedDecks.find((item) => item.deckId === action.deckId);
    if (!deck) {
      return {
        allowed: false,
        reason: `Freeze action references unknown deck ${action.deckId}.`,
        requiresUserReview: true,
      };
    }

    if (deck.chosenPlanId !== action.chosenPlanId) {
      return {
        allowed: false,
        reason: `Freeze action chosen plan ${action.chosenPlanId} does not match committed deck ${deck.chosenPlanId}.`,
        requiresUserReview: true,
      };
    }

    const card = options.snapshot.activeCards.find(
      (item) => item.cardId === action.cardId && item.deckId === action.deckId,
    );
    if (!card) {
      return {
        allowed: false,
        reason: `Freeze action references unknown active card ${action.cardId}.`,
        requiresUserReview: true,
      };
    }

    if (card.chosenPlanId !== action.chosenPlanId) {
      return {
        allowed: false,
        reason: `Freeze action chosen plan ${action.chosenPlanId} does not match active card ${card.chosenPlanId}.`,
        requiresUserReview: true,
      };
    }
  }

  if (action.type === "create-baseline-reminder" || action.type === "create-nudge-reminder") {
    if (action.reminder.kind === "baseline" && !["system-fallback", "user-fixed"].includes(action.reminder.source)) {
      return {
        allowed: false,
        reason: "Baseline reminder must be owned by system-fallback or user-fixed source.",
        requiresUserReview: true,
      };
    }

    if (action.reminder.capabilityRequired !== "none" && !canScheduleExternalReminder(options.notificationCapability)) {
      return {
        allowed: false,
        reason: "External reminder requires notification permission.",
        requiresUserReview: false,
      };
    }
  }

  if (action.type === "create-nudge-reminder" && action.removesReminderIds?.length) {
    const baselineIds = getBaselineReminderIds(options.snapshot);
    if (action.removesReminderIds.some((id) => baselineIds.has(id))) {
      return {
        allowed: false,
        reason: "Agent-refined nudge cannot remove the guaranteed baseline reminder.",
        requiresUserReview: true,
      };
    }
  }

  return {
    allowed: true,
    reason: "QueueAction passed deterministic validation.",
    action,
  };
}

function validateWindowAgainstExistingTimeline(
  snapshot: ScheduleSnapshot,
  window: { startsAt: string; endsAt: string },
):
  | { allowed: true; reason: string }
  | {
      allowed: false;
      reason: string;
      requiresUserReview: boolean;
    } {
  const existingEvent = snapshot.scheduledEvents.find((event) => {
    return (
      event.status !== "cancelled" &&
      event.startsAt &&
      event.endsAt &&
      rangesOverlap(window.startsAt, window.endsAt, event.startsAt, event.endsAt)
    );
  });
  if (existingEvent) {
    return {
      allowed: false,
      reason: `Requested schedule window overlaps existing scheduled event ${existingEvent.id}.`,
      requiresUserReview: true,
    };
  }

  const activeCard = snapshot.activeCards.find((card) => {
    return (
      card.scheduledWindow &&
      rangesOverlap(window.startsAt, window.endsAt, card.scheduledWindow.startAt, card.scheduledWindow.endAt)
    );
  });
  if (activeCard) {
    return {
      allowed: false,
      reason: `Requested schedule window overlaps active scheduled card ${activeCard.cardId}.`,
      requiresUserReview: true,
    };
  }

  return {
    allowed: true,
    reason: "Schedule window does not overlap existing timeline occupancy.",
  };
}

function validateBase(action: QueueAction, snapshot: ScheduleSnapshot): QueueActionValidationResult {
  if (action.snapshotId !== snapshot.id) {
    return {
      allowed: false,
      reason: "QueueAction snapshotId must match the current schedule snapshot.",
      requiresUserReview: true,
    };
  }
  if (!action.reason.trim()) {
    return {
      allowed: false,
      reason: "QueueAction reason is required.",
      requiresUserReview: true,
    };
  }
  if (!action.createdAt) {
    return {
      allowed: false,
      reason: "QueueAction createdAt is required.",
      requiresUserReview: true,
    };
  }
  return { allowed: true, reason: "Base QueueAction fields are valid.", action };
}

function getActionChosenPlanId(action: QueueAction): string | undefined {
  if ("chosenPlanId" in action && action.chosenPlanId) return action.chosenPlanId;
  if (action.type === "insert-schedule-event") return action.event.chosenPlanId;
  if (action.type === "create-baseline-reminder" || action.type === "create-nudge-reminder") {
    return action.reminder.chosenPlanId;
  }
  return undefined;
}

function getBaselineReminderIds(snapshot: ScheduleSnapshot): Set<string> {
  const ids = new Set<string>();
  snapshot.activeCards.forEach((card) => {
    if (card.baselineReminderId) ids.add(card.baselineReminderId);
  });
  snapshot.scheduledEvents.forEach((event) => {
    if (event.kind === "baseline-reminder") ids.add(event.id);
  });
  return ids;
}

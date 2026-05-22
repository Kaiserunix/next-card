import { addMinutes, compareIso, rangesOverlap } from "./time-overlap";
import { validateScheduleWindowAgainstTimeLocks } from "./time-lock-validator";
import type { CommittedCardRef, ScheduleSnapshot, TaskTension, TimeWindow } from "./types";

export type CardWindowPlacement = {
  cardId: string;
  deckId: string;
  chosenPlanId: string;
  tension: TaskTension;
  window: TimeWindow;
};

export type CardWindowConflict = {
  cardId: string;
  reason: string;
};

export type PlanCardWindowsResult = {
  placements: CardWindowPlacement[];
  conflicts: CardWindowConflict[];
};

export function planCardWindows(input: {
  snapshot: ScheduleSnapshot;
  cards: CommittedCardRef[];
  chosenPlanId: string;
}): PlanCardWindowsResult {
  const placements: CardWindowPlacement[] = [];
  const conflicts: CardWindowConflict[] = [];
  const windows = [...input.snapshot.availableWindows].sort((left, right) => compareIso(left.startAt, right.startAt));
  const occupiedRanges = buildSnapshotOccupiedRanges(input.snapshot);
  const cards = input.cards
    .filter((card) => card.chosenPlanId === input.chosenPlanId)
    .sort((left, right) => tensionRank(left.tension) - tensionRank(right.tension));

  for (const card of cards) {
    const placement = findPlacement(input.snapshot, card, windows, occupiedRanges);
    if (placement) {
      placements.push(placement);
      occupiedRanges.push({ startAt: placement.window.startAt, endAt: placement.window.endAt });
      occupiedRanges.sort((left, right) => compareIso(left.startAt, right.startAt));
      continue;
    }

    const attemptedWindow = sortWindowsForCard(card, windows)[0];
    if (attemptedWindow) {
      const startsAt = preferredStartForWindow(card, attemptedWindow) ?? attemptedWindow.startAt;
      const conflict = validateScheduleWindowAgainstTimeLocks({
        snapshot: input.snapshot,
        window: {
          startsAt,
          endsAt: addMinutes(startsAt, card.estimatedMinutes),
        },
        deadlineAt: card.deadlineAt,
      });
      conflicts.push({
        cardId: card.cardId,
        reason: conflict.allowed ? "No available window is long enough." : conflict.reason,
      });
    } else {
      conflicts.push({
        cardId: card.cardId,
        reason: "No safe window is available.",
      });
    }
  }

  return { placements, conflicts };
}

function findPlacement(
  snapshot: ScheduleSnapshot,
  card: CommittedCardRef,
  windows: TimeWindow[],
  occupiedRanges: Array<{ startAt: string; endAt: string }>,
): CardWindowPlacement | null {
  for (const candidate of sortWindowsForCard(card, windows)) {
    const preferredStart = preferredStartForWindow(card, candidate);
    if (!preferredStart) continue;

    const placementWindow = firstOpenWindow({
      snapshot,
      card,
      candidate,
      preferredStart,
      occupiedRanges,
    });
    if (!placementWindow) continue;

    const conflict = validateScheduleWindowAgainstTimeLocks({
      snapshot,
      window: {
        startsAt: placementWindow.startAt,
        endsAt: placementWindow.endAt,
      },
      deadlineAt: card.deadlineAt,
    });
    if (!conflict.allowed) continue;

    return {
      cardId: card.cardId,
      deckId: card.deckId,
      chosenPlanId: card.chosenPlanId,
      tension: card.tension,
      window: {
        id: `window_${card.cardId}`,
        startAt: placementWindow.startAt,
        endAt: placementWindow.endAt,
        timezone: candidate.timezone,
        source: candidate.source,
        confidence: candidate.confidence,
      },
    };
  }

  return null;
}

function firstOpenWindow(input: {
  snapshot: ScheduleSnapshot;
  card: CommittedCardRef;
  candidate: TimeWindow;
  preferredStart: string;
  occupiedRanges: Array<{ startAt: string; endAt: string }>;
}): { startAt: string; endAt: string } | null {
  let startsAt = input.preferredStart;
  const occupiedRanges = input.occupiedRanges
    .filter((range) => rangesOverlap(input.candidate.startAt, input.candidate.endAt, range.startAt, range.endAt))
    .sort((left, right) => compareIso(left.startAt, right.startAt));

  for (const occupied of occupiedRanges) {
    const endsAt = addMinutes(startsAt, input.card.estimatedMinutes);
    if (compareIso(endsAt, input.candidate.endAt) > 0) return null;

    if (!rangesOverlap(startsAt, endsAt, occupied.startAt, occupied.endAt)) continue;
    startsAt = occupied.endAt;
  }

  const endsAt = addMinutes(startsAt, input.card.estimatedMinutes);
  if (compareIso(endsAt, input.candidate.endAt) > 0) return null;

  const conflict = validateScheduleWindowAgainstTimeLocks({
    snapshot: input.snapshot,
    window: { startsAt, endsAt },
    deadlineAt: input.card.deadlineAt,
  });

  return conflict.allowed ? { startAt: startsAt, endAt: endsAt } : null;
}

function sortWindowsForCard(card: CommittedCardRef, windows: TimeWindow[]): TimeWindow[] {
  if (!card.preferredStartAt) return windows;

  const preferredWindows = windows.filter((window) => isInsideWindow(card.preferredStartAt ?? "", window));
  const laterWindows = windows.filter((window) => {
    return !preferredWindows.includes(window) && compareIso(window.endAt, card.preferredStartAt ?? "") > 0;
  });

  return [...preferredWindows, ...laterWindows];
}

function preferredStartForWindow(card: CommittedCardRef, window: TimeWindow): string | null {
  if (!card.preferredStartAt) return window.startAt;
  if (compareIso(window.endAt, card.preferredStartAt) <= 0) return null;
  if (isInsideWindow(card.preferredStartAt, window)) return card.preferredStartAt;
  return window.startAt;
}

function isInsideWindow(value: string, window: TimeWindow): boolean {
  return compareIso(value, window.startAt) >= 0 && compareIso(value, window.endAt) < 0;
}

function buildSnapshotOccupiedRanges(snapshot: ScheduleSnapshot): Array<{ startAt: string; endAt: string }> {
  const ranges: Array<{ startAt: string; endAt: string }> = [];

  for (const lock of snapshot.timeLocks) {
    if (lock.startAt && lock.endAt) ranges.push({ startAt: lock.startAt, endAt: lock.endAt });
  }

  for (const event of snapshot.scheduledEvents) {
    if (event.startsAt && event.endsAt && event.status !== "cancelled") {
      ranges.push({ startAt: event.startsAt, endAt: event.endsAt });
    }
  }

  for (const activeCard of snapshot.activeCards) {
    if (activeCard.scheduledWindow) {
      ranges.push({
        startAt: activeCard.scheduledWindow.startAt,
        endAt: activeCard.scheduledWindow.endAt,
      });
    }
  }

  return ranges.sort((left, right) => compareIso(left.startAt, right.startAt));
}

function tensionRank(tension: TaskTension): number {
  const ranks: Record<TaskTension, number> = {
    hard: 0,
    "deadline-sensitive": 1,
    recommended: 2,
    soft: 3,
    background: 4,
    unknown: 5,
  };
  return ranks[tension];
}

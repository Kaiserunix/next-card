import { isAcceptedProofEvent } from "./proof-reader";
import type { ProofEventRef, ProofSignalAggregate, ReminderAuditRef, RhythmWindowDays } from "./types";

type NormalizeOptions = {
  userId: string;
  windowDays: RhythmWindowDays;
  now?: string;
};

export function normalizeProofSignals(
  events: readonly ProofEventRef[],
  reminderAudit: readonly ReminderAuditRef[] = [],
  options: NormalizeOptions,
): ProofSignalAggregate {
  const now = options.now ?? new Date().toISOString();
  const acceptedEvents = events
    .filter((event) => event.userId === options.userId)
    .filter(isAcceptedProofEvent)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

  const signals: ProofSignalAggregate["signals"] = {};
  const firstCardDelay = average(firstCardStartDelays(acceptedEvents));
  const durationRatio = average(
    acceptedEvents
      .filter((event) => event.type === "card-completed")
      .map((event) =>
        event.estimatedMinutes && event.actualMinutes !== undefined && event.estimatedMinutes > 0
          ? event.actualMinutes / event.estimatedMinutes
          : undefined,
      )
      .filter(isNumber),
  );
  const freezeRate = buildFreezeRate(acceptedEvents);
  const burnCompletionRate = buildBurnCompletionRate(acceptedEvents);
  const recoveryMedian = median(recoveryAfterFreezeMinutes(acceptedEvents));
  const shortCardRate = buildShortCardCompletionRate(acceptedEvents);
  const reminderSignals = buildReminderSignals(options.userId, reminderAudit);

  if (firstCardDelay !== undefined) signals.firstCardStartDelayMinutes = round(firstCardDelay);
  if (durationRatio !== undefined) signals.actualVsEstimatedRatio = round(durationRatio);
  if (freezeRate !== undefined) signals.freezeRate = round(freezeRate);
  if (burnCompletionRate !== undefined) signals.burnCompletionRate = round(burnCompletionRate);
  if (reminderSignals.responseRate !== undefined) signals.deliveredReminderResponseRate = round(reminderSignals.responseRate);
  if (recoveryMedian !== undefined) signals.recoveryAfterFreezeMedianMinutes = round(recoveryMedian);
  if (shortCardRate !== undefined) signals.shortCardCompletionRate = round(shortCardRate);

  return {
    id: `aggregate_${options.userId}_${options.windowDays}_${Date.parse(now) || 0}`,
    userId: options.userId,
    windowDays: options.windowDays,
    createdAt: now,
    evidenceEventIds: acceptedEvents.map((event) => event.id),
    signals,
    dataQuality: {
      evidenceCount: acceptedEvents.length,
      reminderDeliveryReliable: reminderSignals.reliable,
      hasEnoughData: acceptedEvents.length >= 3,
    },
  };
}

function firstCardStartDelays(events: ProofEventRef[]): number[] {
  const deckCreated = new Map<string, ProofEventRef>();
  const delays: number[] = [];

  for (const event of events) {
    if (event.type === "deck-created" && event.deckId) deckCreated.set(event.deckId, event);
    if (event.type === "first-card-started" && event.deckId) {
      const created = deckCreated.get(event.deckId);
      if (created) delays.push(diffMinutes(created.occurredAt, event.occurredAt));
    }
  }

  return delays;
}

function buildFreezeRate(events: ProofEventRef[]): number | undefined {
  const frozen = events.filter((event) => event.type === "card-frozen").length;
  const completed = events.filter((event) => event.type === "card-completed").length;
  const denominator = frozen + completed;
  return denominator === 0 ? undefined : frozen / denominator;
}

function buildBurnCompletionRate(events: ProofEventRef[]): number | undefined {
  const started = events.filter((event) => event.type === "card-burning-started").length;
  if (started === 0) return undefined;
  const completed = events.filter((event) => event.type === "card-burn-completed").length;
  return completed / started;
}

function recoveryAfterFreezeMinutes(events: ProofEventRef[]): number[] {
  const values: number[] = [];
  const frozenEvents = events.filter((event) => event.type === "card-frozen" && event.cardId);

  for (const frozen of frozenEvents) {
    const recovery = events.find(
      (event) =>
        event.cardId === frozen.cardId &&
        Date.parse(event.occurredAt) > Date.parse(frozen.occurredAt) &&
        (event.type === "card-resumed" || event.type === "card-completed"),
    );
    if (recovery) values.push(diffMinutes(frozen.occurredAt, recovery.occurredAt));
  }

  return values;
}

function buildShortCardCompletionRate(events: ProofEventRef[]): number | undefined {
  const completed = events.filter((event) => event.type === "card-completed" && event.estimatedMinutes !== undefined);
  if (completed.length === 0) return undefined;
  return completed.filter((event) => (event.estimatedMinutes ?? Number.POSITIVE_INFINITY) <= 10).length / completed.length;
}

function buildReminderSignals(userId: string, audit: readonly ReminderAuditRef[]): { reliable: boolean; responseRate?: number } {
  const userAudit = audit.filter((entry) => entry.userId === userId);
  const reliable =
    userAudit.length === 0 ||
    userAudit.every((entry) => entry.reliable && entry.deliveryStatus !== "failed" && entry.deliveryStatus !== "permission-missing");

  if (!reliable) return { reliable: false };

  const delivered = new Set(
    userAudit
      .filter((entry) => entry.deliveryStatus === "delivered" && entry.permission === "granted" && entry.reliable)
      .map((entry) => entry.reminderId),
  );
  if (delivered.size === 0) return { reliable };

  const responded = new Set(
    userAudit
      .filter((entry) => entry.deliveryStatus === "responded" && delivered.has(entry.reminderId))
      .map((entry) => entry.reminderId),
  );

  return { reliable, responseRate: responded.size / delivered.size };
}

function diffMinutes(start: string, end: string): number {
  return (Date.parse(end) - Date.parse(start)) / 60000;
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function isNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

import { compareIso, subtractMinutes } from "./time-overlap";
import type { ReminderPlan } from "./types";

export type CreateBaselineReminderPlanInput = {
  id: string;
  cardId: string;
  deckId: string;
  chosenPlanId: string;
  targetTime: string;
  now: string;
  leadMinutes?: number;
  source?: "system-fallback" | "user-fixed";
  capabilityRequired?: ReminderPlan["capabilityRequired"];
};

export function createBaselineReminderPlan(input: CreateBaselineReminderPlanInput): ReminderPlan {
  const leadMinutes = input.leadMinutes ?? 30;
  const baselineFireAt = subtractMinutes(input.targetTime, leadMinutes);
  const shouldFireNow = compareIso(input.now, baselineFireAt) > 0;

  return {
    id: input.id,
    cardId: input.cardId,
    deckId: input.deckId,
    chosenPlanId: input.chosenPlanId,
    fireAt: shouldFireNow ? new Date(Date.parse(input.now)).toISOString() : baselineFireAt,
    kind: "baseline",
    source: input.source ?? "system-fallback",
    capabilityRequired: input.capabilityRequired ?? "browser-notification",
    deliveryStatus: "planned",
    privacyLevel: "low-sensitive",
    reason: shouldFireNow ? "Less time remains than reminder lead time." : `${leadMinutes} minute baseline reminder.`,
  };
}

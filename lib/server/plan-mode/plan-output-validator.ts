import { PlanModeServiceError } from "@/lib/server/plan-mode/errors";
import type { ActionCardDraft, PlanModeDraft, PlanOptionDraft } from "@/lib/server/plan-mode/types";

const EXPECTED_OPTIONS = [
  ["plan-a", "A", "urgent"],
  ["plan-b", "B", "balanced"],
  ["plan-c", "C", "gentle"],
] as const;

const FORBIDDEN_TOP_LEVEL_KEYS = new Set([
  "selectedOptionId",
  "selectedPlanId",
  "selectedPlan",
  "committedDeck",
  "proofRecord",
  "reminderJob",
  "queueAction",
  "scheduleQueuedForOptionId",
  "normalizedDeadlineAt",
]);

const BROAD_ACTIONS = new Set([
  "学习",
  "学习数学",
  "完成作业",
  "做任务",
  "准备",
  "准备一下",
  "努力完成",
  "推进一下",
]);

export function validatePlanModeDraft(draft: PlanModeDraft): PlanModeDraft {
  if (!draft || typeof draft !== "object") {
    throw outputInvalid("PlanModeDraft is required.");
  }

  assertNoForbiddenKeys(draft);
  assertPlanModeNoAuthorityWrites(draft);

  if (!Array.isArray(draft.options) || draft.options.length !== 3) {
    throw outputInvalid("PlanModeDraft must contain exactly three A/B/C options.");
  }

  draft.options.forEach((option, index) => validateOption(option, index));

  if (draft.status === "options-ready") {
    assertNonEmpty(draft.goalUnderstanding, "goalUnderstanding");
    assertNonEmptyArray(draft.keyConstraints, "keyConstraints");
    assertNonEmptyArray(draft.decomposition, "decomposition");
    assertNonEmptyArray(draft.timeStrategy, "timeStrategy");
  }

  return draft;
}

export function isBroadActionCard(card: ActionCardDraft): boolean {
  const title = normalizeBroadText(card.title);
  const action = normalizeBroadText(card.action);
  if (BROAD_ACTIONS.has(title) || BROAD_ACTIONS.has(action)) return true;

  const shortAction = action.replace(/[，。,.]/g, "");
  return shortAction.length <= 6 && [...BROAD_ACTIONS].some((broad) => shortAction.includes(broad));
}

export function assertPlanModeNoAuthorityWrites(draft: PlanModeDraft): void {
  if (
    draft.writes?.deckCommitted !== false ||
    draft.writes?.proofWritten !== false ||
    draft.writes?.remindersCreated !== false ||
    draft.writes?.scheduleQueued !== false
  ) {
    throw outputInvalid("Plan Mode draft contains forbidden authority writes.");
  }
}

function validateOption(option: PlanOptionDraft, index: number): void {
  const [expectedId, expectedMode, expectedStyle] = EXPECTED_OPTIONS[index];
  if (option.id !== expectedId) {
    throw outputInvalid(`Plan option ${index + 1} must have id ${expectedId}.`);
  }
  if (option.mode !== expectedMode) {
    throw outputInvalid("Plan option modes must be A, B, and C in order.");
  }
  if (option.style !== expectedStyle) {
    throw outputInvalid("Plan option styles must be urgent, balanced, and gentle in order.");
  }
  if (!Array.isArray(option.cardDrafts) || option.cardDrafts.length < 3) {
    throw outputInvalid(`Plan option ${option.id} must include at least three card drafts.`);
  }

  option.cardDrafts.forEach((card) => validateCard(card, option.id));
}

function validateCard(card: ActionCardDraft, optionId: string): void {
  assertNonEmpty(card.id, `${optionId}.card.id`);
  assertNonEmpty(card.title, `${optionId}.card.title`);
  assertNonEmpty(card.action, `${optionId}.card.action`);
  assertNonEmpty(card.sourceStageId, `${optionId}.card.sourceStageId`);

  if (!Number.isFinite(card.estimatedMinutes) || card.estimatedMinutes <= 0) {
    throw outputInvalid(`${optionId}.card.estimatedMinutes must be positive.`);
  }
  if (!["progress", "standard", "baseline"].includes(card.objectiveLevel)) {
    throw outputInvalid(`${optionId}.card.objectiveLevel is invalid.`);
  }
  if (!["start-now", "scheduled-window", "before-deadline", "soft-optional"].includes(card.timingIntent)) {
    throw outputInvalid(`${optionId}.card.timingIntent is invalid.`);
  }
  if (isBroadActionCard(card)) {
    throw outputInvalid(`Plan option ${optionId} contains a broad action card.`);
  }
}

function assertNoForbiddenKeys(draft: PlanModeDraft): void {
  for (const key of Object.keys(draft as Record<string, unknown>)) {
    if (FORBIDDEN_TOP_LEVEL_KEYS.has(key)) {
      throw outputInvalid(`Plan Mode draft contains forbidden field ${key}.`);
    }
  }

  visitKeys(draft, (key) => {
    if (/^isSelected$|^selected$|selectedOption|selectedPlan/i.test(key)) {
      throw outputInvalid("Plan Mode draft must not contain selected option markers.");
    }
    if (/scheduleQueuedForOption|queueAction|reminderJob|proofRecord|committedDeck/i.test(key)) {
      throw outputInvalid("Plan Mode draft must not contain schedule, reminder, proof, or deck authority fields.");
    }
    if (/normalizedDeadlineAt/i.test(key)) {
      throw outputInvalid("Plan Mode draft must not invent normalized deadline authority.");
    }
  });
}

function visitKeys(value: unknown, onKey: (key: string) => void): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) visitKeys(item, onKey);
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    onKey(key);
    visitKeys(child, onKey);
  }
}

function assertNonEmpty(value: unknown, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw outputInvalid(`PlanModeDraft.${field} is required.`);
  }
}

function assertNonEmptyArray(value: unknown, field: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw outputInvalid(`PlanModeDraft.${field} is required.`);
  }
}

function normalizeBroadText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function outputInvalid(message: string): PlanModeServiceError {
  return new PlanModeServiceError("PLAN_OUTPUT_INVALID", message, 502, true);
}

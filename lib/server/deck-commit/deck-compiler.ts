import { createHash, randomUUID } from "node:crypto";
import type { PlanModeDraft, PlanOptionDraft } from "@/lib/server/plan-mode/types";
import type { CommittedCard, CommittedDeck, DeckCommitRequest } from "@/lib/server/deck-commit/types";
import type { TaskTension } from "@/lib/server/time-guardian/types";

export type CompileCommittedDeckInput = {
  draft: PlanModeDraft;
  option: PlanOptionDraft;
  request: DeckCommitRequest;
  createdAt: string;
};

export function compileCommittedDeck(input: CompileCommittedDeckInput): {
  deck: CommittedDeck;
  cards: CommittedCard[];
} {
  const deckId = `deck_${stableId(input.draft.id, input.option.id, input.request.requestId)}`;
  const tension = tensionForOption(input.option);

  const deck: CommittedDeck = {
    deckId,
    planModeDraftId: input.draft.id,
    planCompilerHandoffId: input.draft.planCompilerHandoffId,
    verifiedInputBundleId: input.draft.verifiedInputBundleId,
    selectedOptionId: input.option.id,
    title: input.option.title || input.draft.goalUnderstanding,
    summary: input.option.summary,
    source: input.draft.source,
    status: "committed",
    totalCards: input.option.cardDrafts.length,
    createdAt: input.createdAt,
    userId: input.request.userId,
    anonymousDeviceId: input.request.anonymousDeviceId,
  };

  const cards = input.option.cardDrafts.map((cardDraft, index): CommittedCard => {
    const timing = timingHints(cardDraft.timingIntent, input.draft.keyConstraints);
    return {
      cardId: `card_${stableId(deckId, cardDraft.id, String(index + 1))}`,
      deckId,
      planModeDraftId: input.draft.id,
      selectedOptionId: input.option.id,
      sourceCardDraftId: cardDraft.id,
      sourceStageId: cardDraft.sourceStageId,
      title: cardDraft.title,
      action: cardDraft.action,
      estimatedMinutes: cardDraft.estimatedMinutes,
      objectiveLevel: cardDraft.objectiveLevel,
      timingIntent: cardDraft.timingIntent,
      tension,
      hardLockRefs: hardLockRefs(input.draft.keyConstraints),
      deadlineAt: timing.deadlineAt,
      preferredStartAt: timing.preferredStartAt,
      status: "queued",
      sequence: index + 1,
      createdAt: input.createdAt,
    };
  });

  return { deck, cards };
}

function stableId(...parts: string[]): string {
  const digest = createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 16);
  return digest || randomUUID();
}

function tensionForOption(option: PlanOptionDraft): TaskTension {
  if (option.style === "urgent" || option.riskLevel === "high") return "deadline-sensitive";
  if (option.style === "gentle") return "recommended";
  return "hard";
}

function hardLockRefs(constraints: string[]): string[] {
  return constraints
    .filter((constraint) => /课|class|deadline|截止|提交|考试|08:00|早八/i.test(constraint))
    .map((constraint) => `constraint:${constraint}`);
}

function timingHints(
  timingIntent: CommittedCard["timingIntent"],
  constraints: string[],
): Pick<CommittedCard, "deadlineAt" | "preferredStartAt"> {
  const normalized = constraints.find((constraint) => /\d{4}-\d{2}-\d{2}T/.test(constraint));
  const iso = normalized?.match(/\d{4}-\d{2}-\d{2}T[0-9:+.\-Z]+/)?.[0];

  if (timingIntent === "before-deadline") return { deadlineAt: iso };
  if (timingIntent === "scheduled-window") return { preferredStartAt: iso };
  return {};
}

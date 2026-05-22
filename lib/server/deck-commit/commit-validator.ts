import type { PlanModeDraft } from "@/lib/server/plan-mode/types";
import type { CommittedDeck, DeckCommitRequest } from "@/lib/server/deck-commit/types";

export class DeckCommitError extends Error {
  constructor(
    public readonly code:
      | "INVALID_DECK_COMMIT_REQUEST"
      | "PLAN_MODE_DRAFT_NOT_FOUND"
      | "PLAN_MODE_DRAFT_NOT_COMMITTABLE"
      | "SELECTED_OPTION_NOT_FOUND"
      | "DUPLICATE_DECK_COMMIT",
    message: string,
    public readonly status = 400,
    public readonly recoverable = true,
  ) {
    super(message);
    this.name = "DeckCommitError";
  }
}

const OPTION_IDS = ["plan-a", "plan-b", "plan-c"] as const;

export function validateDeckCommitRequest(input: unknown): DeckCommitRequest {
  if (!isRecord(input)) {
    throw new DeckCommitError("INVALID_DECK_COMMIT_REQUEST", "Deck commit request must be a JSON object.");
  }

  const selectedOptionId = input.selectedOptionId;
  if (
    typeof input.requestId !== "string" ||
    typeof input.planModeDraftId !== "string" ||
    !OPTION_IDS.includes(selectedOptionId as (typeof OPTION_IDS)[number])
  ) {
    throw new DeckCommitError(
      "INVALID_DECK_COMMIT_REQUEST",
      "Deck commit request requires requestId, planModeDraftId, and selectedOptionId.",
    );
  }

  return {
    requestId: input.requestId,
    planModeDraftId: input.planModeDraftId,
    selectedOptionId: selectedOptionId as DeckCommitRequest["selectedOptionId"],
    anonymousDeviceId: typeof input.anonymousDeviceId === "string" ? input.anonymousDeviceId : undefined,
    userId: typeof input.userId === "string" ? input.userId : undefined,
    clientContext: isRecord(input.clientContext)
      ? {
          now: typeof input.clientContext.now === "string" ? input.clientContext.now : undefined,
          timezone: typeof input.clientContext.timezone === "string" ? input.clientContext.timezone : undefined,
        }
      : undefined,
  };
}

export function validateDraftCanCommit(draft: PlanModeDraft | null): PlanModeDraft {
  if (!draft) {
    throw new DeckCommitError("PLAN_MODE_DRAFT_NOT_FOUND", "Plan Mode draft was not found.", 404, true);
  }

  if (draft.status !== "options-ready") {
    throw new DeckCommitError("PLAN_MODE_DRAFT_NOT_COMMITTABLE", "Plan Mode draft is not ready for deck commit.");
  }

  if (draft.writes.deckCommitted || draft.writes.proofWritten || draft.writes.remindersCreated || draft.writes.scheduleQueued) {
    throw new DeckCommitError("PLAN_MODE_DRAFT_NOT_COMMITTABLE", "Plan Mode draft must not have authoritative writes.");
  }

  return draft;
}

export function validateSelectedOption(draft: PlanModeDraft, selectedOptionId: DeckCommitRequest["selectedOptionId"]) {
  const option = draft.options.find((item) => item.id === selectedOptionId);
  if (!option) {
    throw new DeckCommitError("SELECTED_OPTION_NOT_FOUND", "Selected Plan Mode option does not exist.");
  }

  if (option.cardDrafts.length === 0) {
    throw new DeckCommitError("PLAN_MODE_DRAFT_NOT_COMMITTABLE", "Selected option has no card drafts.");
  }

  return option;
}

export function validateNoExistingCommit(existing: CommittedDeck | null): void {
  if (existing) {
    throw new DeckCommitError("DUPLICATE_DECK_COMMIT", "This Plan Mode draft has already been committed.", 409, false);
  }
}

export function toDeckCommitErrorResponse(error: unknown): Response {
  if (error instanceof DeckCommitError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
        recoverable: error.recoverable,
      },
      { status: error.status },
    );
  }

  return Response.json(
    {
      error: "DECK_COMMIT_FAILED",
      message: "Deck commit failed.",
      recoverable: true,
    },
    { status: 500 },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

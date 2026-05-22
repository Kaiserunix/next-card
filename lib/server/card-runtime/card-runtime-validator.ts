import type { CommittedCard, CommittedDeck } from "@/lib/server/deck-commit/types";
import type { CardRuntimeAction, CardRuntimeActionRequest, CardRuntimeState, CardRuntimeStatus } from "@/lib/server/card-runtime/types";
import type { NotificationCapability, TimeLock, TimeWindow } from "@/lib/server/time-guardian/types";

export class CardRuntimeError extends Error {
  constructor(
    public readonly code:
      | "INVALID_CARD_RUNTIME_REQUEST"
      | "CARD_RUNTIME_IDEMPOTENCY_CONFLICT"
      | "COMMITTED_DECK_NOT_FOUND"
      | "COMMITTED_CARD_NOT_FOUND"
      | "INVALID_CARD_RUNTIME_TRANSITION",
    message: string,
    public readonly status = 400,
    public readonly recoverable = true,
  ) {
    super(message);
    this.name = "CardRuntimeError";
  }
}

const ACTIONS = new Set<CardRuntimeAction>(["start", "complete", "freeze", "burn_start", "burn_complete", "defer", "resume"]);
const NOTIFICATION_CAPABILITIES = new Set<NotificationCapability>([
  "unknown",
  "external_granted",
  "external_denied",
  "external_revoked",
  "in_app_only",
]);

export function validateCardRuntimeActionRequest(input: unknown): CardRuntimeActionRequest {
  if (!isRecord(input)) {
    throw new CardRuntimeError("INVALID_CARD_RUNTIME_REQUEST", "Card Runtime request must be a JSON object.");
  }
  if (typeof input.requestId !== "string" || !input.requestId.trim()) {
    throw new CardRuntimeError("INVALID_CARD_RUNTIME_REQUEST", "requestId is required.");
  }
  if (typeof input.deckId !== "string" || !input.deckId.trim() || typeof input.cardId !== "string" || !input.cardId.trim()) {
    throw new CardRuntimeError("INVALID_CARD_RUNTIME_REQUEST", "deckId and cardId are required.");
  }
  if (!ACTIONS.has(input.action as CardRuntimeAction)) {
    throw new CardRuntimeError("INVALID_CARD_RUNTIME_REQUEST", "action is invalid.");
  }

  return {
    requestId: input.requestId,
    deckId: input.deckId,
    cardId: input.cardId,
    action: input.action as CardRuntimeAction,
    actualMinutes: typeof input.actualMinutes === "number" && Number.isFinite(input.actualMinutes) ? input.actualMinutes : undefined,
    reason: typeof input.reason === "string" ? input.reason : undefined,
    deferToWindow: readTimeWindow(input.deferToWindow),
    fromWindow: readTimeWindow(input.fromWindow),
    timeLocks: readTimeLocks(input.timeLocks),
    availableWindows: readTimeWindows(input.availableWindows),
    notificationCapability: NOTIFICATION_CAPABILITIES.has(input.notificationCapability as NotificationCapability)
      ? (input.notificationCapability as NotificationCapability)
      : undefined,
    clientContext: isRecord(input.clientContext)
      ? {
          now: typeof input.clientContext.now === "string" ? input.clientContext.now : undefined,
          timezone: typeof input.clientContext.timezone === "string" ? input.clientContext.timezone : undefined,
          anonymousDeviceId:
            typeof input.clientContext.anonymousDeviceId === "string" ? input.clientContext.anonymousDeviceId : undefined,
          userId: typeof input.clientContext.userId === "string" ? input.clientContext.userId : undefined,
        }
      : undefined,
  };
}

export function requireCommittedDeck(deck: CommittedDeck | null, deckId: string): CommittedDeck {
  if (!deck || deck.deckId !== deckId) {
    throw new CardRuntimeError("COMMITTED_DECK_NOT_FOUND", "Committed deck was not found.", 404, true);
  }
  return deck;
}

export function requireCommittedCard(cards: CommittedCard[], cardId: string): CommittedCard {
  const card = cards.find((item) => item.cardId === cardId);
  if (!card) {
    throw new CardRuntimeError("COMMITTED_CARD_NOT_FOUND", "Committed card was not found in the selected deck.", 404, true);
  }
  return card;
}

export function validateTransition(state: CardRuntimeState, action: CardRuntimeAction): void {
  const allowed: Record<CardRuntimeStatus, CardRuntimeAction[]> = {
    queued: ["start", "complete", "freeze", "burn_start", "defer"],
    active: ["complete", "freeze", "burn_start", "defer"],
    burning: ["complete", "freeze", "burn_complete", "defer"],
    completed: [],
    frozen: ["resume"],
    deferred: ["resume", "complete", "freeze", "defer"],
  };

  if (!allowed[state.status].includes(action)) {
    throw new CardRuntimeError(
      "INVALID_CARD_RUNTIME_TRANSITION",
      `Cannot apply ${action} to a ${state.status} card.`,
      409,
      true,
    );
  }
}

export function toCardRuntimeErrorResponse(error: unknown): Response {
  if (error instanceof CardRuntimeError) {
    return Response.json(
      {
        error: error.code,
        message: sanitizeError(error),
        recoverable: error.recoverable,
      },
      { status: error.status },
    );
  }

  return Response.json(
    {
      error: "CARD_RUNTIME_ACTION_FAILED",
      message: "Card Runtime action failed.",
      recoverable: true,
    },
    { status: 500 },
  );
}

function readTimeWindows(value: unknown): TimeWindow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(readRequiredTimeWindow);
}

function readTimeWindow(value: unknown): TimeWindow | undefined {
  if (value === undefined) return undefined;
  return readRequiredTimeWindow(value);
}

function readRequiredTimeWindow(value: unknown): TimeWindow {
  if (!isRecord(value)) throw new CardRuntimeError("INVALID_CARD_RUNTIME_REQUEST", "Time window must be an object.");
  const startAt = readString(value.startAt, "time window startAt");
  const endAt = readString(value.endAt, "time window endAt");
  if (Number.isNaN(Date.parse(startAt)) || Number.isNaN(Date.parse(endAt)) || Date.parse(endAt) <= Date.parse(startAt)) {
    throw new CardRuntimeError("INVALID_CARD_RUNTIME_REQUEST", "Time window must contain valid startAt/endAt values.");
  }
  return {
    id: readString(value.id, "time window id"),
    startAt,
    endAt,
    timezone: readString(value.timezone, "time window timezone"),
    source: value.source === "derived" || value.source === "user-stated" || value.source === "calendar-gap" || value.source === "default"
      ? value.source
      : "user-stated",
    confidence: typeof value.confidence === "number" ? value.confidence : 1,
  };
}

function readTimeLocks(value: unknown): TimeLock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((lock): TimeLock => {
    if (!isRecord(lock)) throw new CardRuntimeError("INVALID_CARD_RUNTIME_REQUEST", "TimeLock must be an object.");
    return {
      id: readString(lock.id, "time lock id"),
      userId: typeof lock.userId === "string" ? lock.userId : "anon",
      kind: lock.kind === "class_time" || lock.kind === "exam_time" || lock.kind === "submission_deadline" || lock.kind === "fixed_calendar_event" || lock.kind === "user_locked_block"
        ? lock.kind
        : "user_locked_block",
      startAt: typeof lock.startAt === "string" ? lock.startAt : undefined,
      endAt: typeof lock.endAt === "string" ? lock.endAt : undefined,
      dueAt: typeof lock.dueAt === "string" ? lock.dueAt : undefined,
      timezone: typeof lock.timezone === "string" ? lock.timezone : "Asia/Shanghai",
      movable: false,
      sourceRefs: Array.isArray(lock.sourceRefs) ? (lock.sourceRefs as TimeLock["sourceRefs"]) : [],
      reviewStatus: lock.reviewStatus === "verified" || lock.reviewStatus === "user-confirmed" ? lock.reviewStatus : "user-confirmed",
      conflictStatus: lock.conflictStatus === "conflict_detected" || lock.conflictStatus === "resolved" ? lock.conflictStatus : "none",
    };
  });
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new CardRuntimeError("INVALID_CARD_RUNTIME_REQUEST", `${label} is required.`);
  }
  return value.trim();
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/tp-[A-Za-z0-9._-]+/g, "tp-[redacted]")
    .replace(/data:[^"'\s]+/g, "data:[redacted]")
    .slice(0, 300);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

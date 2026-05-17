import type { QueueAction, QueueActionKind } from "@/lib/types";

const MAX_ID_LENGTH = 160;
const MAX_TITLE_LENGTH = 240;
const MAX_REASON_LENGTH = 500;

type ValidationResult =
  | { ok: true; action: QueueAction }
  | { ok: false; error: string };

export function validateQueueAction(input: unknown, allowedKinds: readonly QueueActionKind[]): ValidationResult {
  if (!isRecord(input)) {
    return { ok: false, error: "QueueAction object is required" };
  }

  const kind = stringValue(input.kind);
  if (!kind || !allowedKinds.includes(kind as QueueActionKind)) {
    return { ok: false, error: `QueueAction kind must be one of: ${allowedKinds.join(", ")}` };
  }

  const id = boundedString(input.id, MAX_ID_LENGTH);
  const targetId = boundedString(input.targetId, MAX_ID_LENGTH);
  const title = boundedString(input.title, MAX_TITLE_LENGTH);
  const reason = boundedString(input.reason, MAX_REASON_LENGTH);
  if (!id || !targetId || !title || !reason) {
    return { ok: false, error: "QueueAction id, targetId, title, and reason are required" };
  }

  const priority = numberValue(input.priority);
  if (priority === null || priority < 0 || priority > 100) {
    return { ok: false, error: "QueueAction priority must be a number from 0 to 100" };
  }

  const confidence = numberValue(input.confidence);
  if (confidence === null || confidence < 0 || confidence > 1) {
    return { ok: false, error: "QueueAction confidence must be a number from 0 to 1" };
  }

  const createdAt = isoString(input.createdAt);
  if (!createdAt) {
    return { ok: false, error: "QueueAction createdAt must be an ISO date string" };
  }

  const scheduledFor = input.scheduledFor === undefined ? undefined : isoString(input.scheduledFor);
  if (input.scheduledFor !== undefined && !scheduledFor) {
    return { ok: false, error: "QueueAction scheduledFor must be an ISO date string" };
  }

  let position: number | undefined;
  if (input.position !== undefined) {
    const parsedPosition = numberValue(input.position);
    if (parsedPosition === null || parsedPosition < 0 || !Number.isInteger(parsedPosition)) {
      return { ok: false, error: "QueueAction position must be a non-negative integer" };
    }
    position = parsedPosition;
  }

  return {
    ok: true,
    action: {
      id,
      kind: kind as QueueActionKind,
      targetId,
      title,
      priority,
      position,
      scheduledFor,
      payload: isRecord(input.payload) ? input.payload : undefined,
      reason,
      confidence,
      requiresUserReview: input.requiresUserReview === true,
      respectsLocks: input.respectsLocks !== false,
      createdAt
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function boundedString(value: unknown, maxLength: number) {
  const normalized = stringValue(value);
  return normalized && normalized.length <= maxLength ? normalized : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isoString(value: unknown) {
  const normalized = stringValue(value);
  return normalized && Number.isFinite(Date.parse(normalized)) ? normalized : "";
}

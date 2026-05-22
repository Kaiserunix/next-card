import type { QueueAction } from "./types";

export type IdempotencyStore = {
  remember(action: QueueAction): boolean;
  has(action: QueueAction): boolean;
};

export function getQueueActionIdempotencyKey(action: QueueAction): string {
  if (action.idempotencyKey) return action.idempotencyKey;
  if (action.type === "insert-schedule-event") {
    const event = action.event;
    return [action.snapshotId, action.type, event.kind, event.deckId, event.cardId, event.startsAt, event.fireAt]
      .filter(Boolean)
      .join(":");
  }
  return `${action.snapshotId}:${action.type}:${action.id}`;
}

export function createIdempotencyStore(seed: QueueAction[] = []): IdempotencyStore {
  const keys = new Set(seed.map(getQueueActionIdempotencyKey));

  return {
    remember(action) {
      const key = getQueueActionIdempotencyKey(action);
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    },
    has(action) {
      return keys.has(getQueueActionIdempotencyKey(action));
    },
  };
}

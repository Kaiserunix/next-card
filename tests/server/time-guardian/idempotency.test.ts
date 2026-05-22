import { describe, expect, it } from "vitest";

import { createIdempotencyStore, getQueueActionIdempotencyKey } from "@/lib/server/time-guardian/idempotency";
import { scheduledEvent, snapshot } from "./test-utils";

describe("time guardian idempotency", () => {
  it("deduplicates repeated queue actions by idempotency key", () => {
    const store = createIdempotencyStore();
    const action = {
      type: "insert-schedule-event" as const,
      id: "action_insert_prepare",
      snapshotId: snapshot().id,
      actor: "system-service" as const,
      reason: "Insert one verified prep card window.",
      createdAt: "2026-05-21T07:00:00+08:00",
      idempotencyKey: "deck_calculus:card_prepare:window",
      event: scheduledEvent(),
    };

    expect(store.remember(action)).toBe(true);
    expect(store.remember(action)).toBe(false);
    expect(getQueueActionIdempotencyKey(action)).toBe("deck_calculus:card_prepare:window");
  });
});

import { describe, expect, it } from "vitest";
import { getProcessableProviderActions } from "@/lib/server/provider-dispatch";
import type { QueueAction } from "@/lib/types";

const now = "2026-05-17T12:00:00.000Z";

describe("provider dispatch filtering", () => {
  it("holds future reminders while allowing due reminders and calendar writes", () => {
    const actions: QueueAction[] = [
      action("future-reminder", "create-reminder", "2026-05-17T13:00:00.000Z"),
      action("due-reminder", "create-reminder", "2026-05-17T11:59:00.000Z"),
      action("calendar", "create-calendar-event", "2026-05-18T08:00:00.000Z")
    ];

    expect(getProcessableProviderActions(actions, now).map((item) => item.id)).toEqual([
      "due-reminder",
      "calendar"
    ]);
  });
});

function action(id: string, kind: QueueAction["kind"], scheduledFor: string): QueueAction {
  return {
    id,
    kind,
    targetId: id,
    title: id,
    priority: 50,
    scheduledFor,
    reason: "test",
    confidence: 0.8,
    requiresUserReview: false,
    respectsLocks: true,
    createdAt: now
  };
}

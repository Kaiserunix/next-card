import { describe, expect, it, vi } from "vitest";
import { dispatchProviderActions } from "@/lib/server/provider-dispatch";
import type { BackendPorts } from "@/lib/server/backend-ports";
import type { QueueAction } from "@/lib/types";

const now = "2026-05-17T10:00:00.000Z";

function action(kind: QueueAction["kind"], targetId: string): QueueAction {
  return {
    id: `${kind}:${targetId}:2026`,
    kind,
    targetId,
    title: targetId,
    priority: 80,
    scheduledFor: "2026-05-17T10:30:00.000Z",
    reason: "测试 provider dispatch",
    confidence: 0.9,
    requiresUserReview: false,
    respectsLocks: true,
    createdAt: now
  };
}

function ports(): Pick<BackendPorts, "notifications" | "calendar"> {
  return {
    notifications: {
      createOrUpdate: vi.fn().mockResolvedValue({ providerId: "web-push:reminder", status: "scheduled" })
    },
    calendar: {
      createOrUpdate: vi.fn().mockResolvedValue({ providerId: "ics:event", status: "created", filePath: "event.ics" })
    }
  };
}

describe("provider dispatch", () => {
  it("dispatches only reminder and calendar actions to their real providers", async () => {
    const providerPorts = ports();
    const results = await dispatchProviderActions(
      [
        action("create-reminder", "reminder"),
        action("create-calendar-event", "event"),
        action("deal-card", "card")
      ],
      providerPorts
    );

    expect(providerPorts.notifications.createOrUpdate).toHaveBeenCalledTimes(1);
    expect(providerPorts.calendar.createOrUpdate).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      expect.objectContaining({ actionId: "create-reminder:reminder:2026", provider: "notification", status: "scheduled" }),
      expect.objectContaining({ actionId: "create-calendar-event:event:2026", provider: "calendar", status: "created" })
    ]);
  });

  it("captures provider failures without hiding the failed action", async () => {
    const providerPorts = ports();
    vi.mocked(providerPorts.notifications.createOrUpdate).mockRejectedValueOnce(new Error("VAPID missing"));

    const results = await dispatchProviderActions([action("create-reminder", "reminder")], providerPorts);

    expect(results).toEqual([
      expect.objectContaining({
        actionId: "create-reminder:reminder:2026",
        provider: "notification",
        status: "failed",
        error: "VAPID missing"
      })
    ]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createWebPushNotificationProvider } from "@/lib/server/providers/web-push-notification-provider";
import type { PushSubscriptionRecord, WebPushClient } from "@/lib/server/providers/web-push-notification-provider";
import type { QueueAction } from "@/lib/types";

const now = "2026-05-17T10:00:00.000Z";

function action(overrides: Partial<QueueAction> = {}): QueueAction {
  return {
    id: overrides.id ?? "create-reminder:card-1:2026",
    kind: overrides.kind ?? "create-reminder",
    targetId: overrides.targetId ?? "card-1",
    title: overrides.title ?? "出门去高数课",
    priority: overrides.priority ?? 92,
    scheduledFor: overrides.scheduledFor ?? "2026-05-17T10:10:00.000Z",
    payload: overrides.payload,
    reason: overrides.reason ?? "时间压力达到提醒阈值。",
    confidence: 0.9,
    requiresUserReview: false,
    respectsLocks: true,
    createdAt: now
  };
}

function subscription(): PushSubscriptionRecord {
  return {
    id: "sub-1",
    userId: "local-user",
    endpoint: "https://push.example.test/subscription",
    keys: {
      p256dh: "p256dh-key",
      auth: "auth-key"
    },
    createdAt: now
  };
}

describe("WebPushNotificationProvider", () => {
  it("sends reminder actions through Web Push with VAPID details and a structured payload", async () => {
    const sendNotification = vi.fn().mockResolvedValue({ statusCode: 201 });
    const setVapidDetails = vi.fn();
    const client: WebPushClient = { setVapidDetails, sendNotification };
    const provider = createWebPushNotificationProvider({
      config: {
        subject: "mailto:admin@example.com",
        publicKey: "public-vapid-key",
        privateKey: "private-vapid-key",
        defaultUrl: "https://next-card.example/deck"
      },
      client,
      subscriptionRepository: {
        async listActive() {
          return [subscription()];
        },
        async remove() {}
      }
    });

    const result = await provider.createOrUpdate(action());

    expect(setVapidDetails).toHaveBeenCalledWith("mailto:admin@example.com", "public-vapid-key", "private-vapid-key");
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [sentSubscription, payload, options] = sendNotification.mock.calls[0];
    expect(sentSubscription).toMatchObject({
      endpoint: "https://push.example.test/subscription",
      keys: { p256dh: "p256dh-key", auth: "auth-key" }
    });
    expect(JSON.parse(payload)).toMatchObject({
      title: "Next Card",
      body: "出门去高数课",
      tag: "card-1",
      data: {
        actionId: "create-reminder:card-1:2026",
        targetId: "card-1",
        url: "https://next-card.example/deck"
      }
    });
    expect(options).toMatchObject({ TTL: 3600, urgency: "high" });
    expect(result).toMatchObject({
      providerId: "web-push:card-1",
      status: "scheduled",
      sentCount: 1,
      failedCount: 0
    });
  });

  it("removes expired subscriptions and reports partial delivery", async () => {
    const expired = { ...subscription(), id: "expired", endpoint: "https://push.example.test/expired" };
    const removed: string[] = [];
    const sendNotification = vi
      .fn()
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }));
    const provider = createWebPushNotificationProvider({
      config: {
        subject: "mailto:admin@example.com",
        publicKey: "public-vapid-key",
        privateKey: "private-vapid-key"
      },
      client: { setVapidDetails: vi.fn(), sendNotification },
      subscriptionRepository: {
        async listActive() {
          return [subscription(), expired];
        },
        async remove(id) {
          removed.push(id);
        }
      }
    });

    const result = await provider.createOrUpdate(action());

    expect(removed).toEqual(["expired"]);
    expect(result).toMatchObject({
      status: "scheduled",
      sentCount: 1,
      failedCount: 1
    });
  });

  it("fails loudly when VAPID config is missing instead of pretending to schedule", async () => {
    const provider = createWebPushNotificationProvider({
      config: {
        subject: "",
        publicKey: "",
        privateKey: ""
      },
      client: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
      subscriptionRepository: {
        async listActive() {
          return [subscription()];
        },
        async remove() {}
      }
    });

    await expect(provider.createOrUpdate(action())).rejects.toThrow("Missing Web Push VAPID configuration");
  });

  it("skips non-reminder actions", async () => {
    const sendNotification = vi.fn();
    const provider = createWebPushNotificationProvider({
      config: {
        subject: "mailto:admin@example.com",
        publicKey: "public-vapid-key",
        privateKey: "private-vapid-key"
      },
      client: { setVapidDetails: vi.fn(), sendNotification },
      subscriptionRepository: {
        async listActive() {
          return [subscription()];
        },
        async remove() {}
      }
    });

    const result = await provider.createOrUpdate(action({ kind: "deal-card" }));

    expect(sendNotification).not.toHaveBeenCalled();
    expect(result.status).toBe("skipped");
  });
});

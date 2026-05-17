import { describe, expect, it } from "vitest";
import { getVapidPublicKeyResponse, registerPushSubscription } from "@/lib/server/push-service";
import type { PushSubscriptionRecord } from "@/lib/server/providers/web-push-notification-provider";

describe("push service", () => {
  it("returns whether the public VAPID key is configured without exposing private config", () => {
    expect(getVapidPublicKeyResponse("public-key")).toEqual({
      configured: true,
      publicKey: "public-key"
    });
    expect(getVapidPublicKeyResponse("")).toEqual({
      configured: false,
      publicKey: null
    });
  });

  it("registers browser PushSubscription JSON in the provider repository", async () => {
    const saved: PushSubscriptionRecord[] = [];
    const result = await registerPushSubscription(
      {
        endpoint: "https://push.example.test/sub",
        keys: {
          p256dh: "p256dh",
          auth: "auth"
        }
      },
      {
        async listActive() {
          return saved;
        },
        async remove() {},
        async upsert(record) {
          saved.push(record);
        }
      },
      "local-user"
    );

    expect(result.status).toBe("saved");
    expect(saved[0]).toMatchObject({
      endpoint: "https://push.example.test/sub",
      userId: "local-user",
      keys: {
        p256dh: "p256dh",
        auth: "auth"
      }
    });
  });

  it("rejects malformed subscription payloads", async () => {
    await expect(
      registerPushSubscription(
        { endpoint: "https://push.example.test/sub", keys: { p256dh: "" } },
        {
          async listActive() {
            return [];
          },
          async remove() {},
          async upsert() {}
        }
      )
    ).rejects.toThrow("Invalid PushSubscription");
  });
});

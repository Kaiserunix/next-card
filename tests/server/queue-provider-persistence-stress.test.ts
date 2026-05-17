import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchProviderActions } from "@/lib/server/provider-dispatch";
import { JsonFileQueueRepository, MemoryQueueRepository } from "@/lib/server/queue-repository";
import { createIcsCalendarProvider } from "@/lib/server/providers/ics-calendar-provider";
import { JsonFilePushSubscriptionRepository } from "@/lib/server/providers/push-subscription-repository";
import { createWebPushNotificationProvider } from "@/lib/server/providers/web-push-notification-provider";
import type { BackendPorts } from "@/lib/server/backend-ports";
import type { BackendWorkerSnapshot, QueueAction } from "@/lib/types";
import type { PushSubscriptionRecord, WebPushClient } from "@/lib/server/providers/web-push-notification-provider";

const now = "2026-05-17T10:00:00.000Z";
const later = "2026-05-17T10:30:00.000Z";
const baseDir = join(tmpdir(), "next-card-queue-provider-stress", `${process.pid}`);

function action(kind: QueueAction["kind"], targetId: string, overrides: Partial<QueueAction> = {}): QueueAction {
  return {
    id: overrides.id ?? `${kind}:${targetId}:2026`,
    kind,
    targetId,
    title: overrides.title ?? targetId,
    priority: overrides.priority ?? 86,
    scheduledFor: overrides.scheduledFor ?? later,
    payload: overrides.payload,
    reason: overrides.reason ?? "压力测试 provider 调度。",
    confidence: overrides.confidence ?? 0.9,
    requiresUserReview: overrides.requiresUserReview ?? false,
    respectsLocks: overrides.respectsLocks ?? true,
    createdAt: overrides.createdAt ?? now
  };
}

function snapshot(overrides: Partial<BackendWorkerSnapshot> = {}): BackendWorkerSnapshot {
  return {
    now,
    queueItems: [],
    activeQueue: [],
    timeLocks: [],
    frozenTasks: [],
    hiddenGoals: [],
    processedActionIds: [],
    ...overrides
  };
}

function subscription(overrides: Partial<PushSubscriptionRecord> = {}): PushSubscriptionRecord {
  return {
    id: overrides.id ?? "push-sub-1",
    userId: overrides.userId ?? "local-user",
    endpoint: overrides.endpoint ?? "https://push.example.test/one",
    expirationTime: overrides.expirationTime,
    keys: overrides.keys ?? {
      p256dh: "p256dh-key",
      auth: "auth-key"
    },
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt
  };
}

describe("queue and provider persistence stress", () => {
  beforeEach(async () => {
    await rm(baseDir, { force: true, recursive: true });
    await mkdir(baseDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(baseDir, { force: true, recursive: true });
  });

  it("roundtrips JsonFileQueueRepository snapshots and marks processed actions idempotently", async () => {
    const filePath = join(baseDir, "queue", "snapshot.json");
    const repository = new JsonFileQueueRepository(filePath);
    const actions = [
      action("create-reminder", "card-1"),
      action("create-calendar-event", "event-1"),
      action("create-reminder", "card-1")
    ];

    await repository.writeSnapshot(snapshot({ activeQueue: ["card-1"] }));
    await repository.markActionsProcessed(actions);
    await repository.markActionsProcessed(actions.slice(0, 2));

    const reloaded = await new JsonFileQueueRepository(filePath).readSnapshot("2026-05-17T11:00:00.000Z");

    expect(reloaded).toMatchObject({
      now: "2026-05-17T11:00:00.000Z",
      activeQueue: ["card-1"],
      processedActionIds: ["create-reminder:card-1:2026", "create-calendar-event:event-1:2026"]
    });
    await expect(readFile(filePath, "utf8")).resolves.toContain('"processedActionIds"');
  });

  it("falls back to an empty queue snapshot when the JSON file is missing or corrupted", async () => {
    const filePath = join(baseDir, "queue", "corrupt.json");
    const repository = new JsonFileQueueRepository(filePath);

    await expect(repository.readSnapshot(now)).resolves.toMatchObject({
      now,
      queueItems: [],
      processedActionIds: []
    });

    await mkdir(join(baseDir, "queue"), { recursive: true });
    await writeFile(filePath, "{ bad json", "utf8");

    await expect(repository.readSnapshot(later)).resolves.toMatchObject({
      now: later,
      queueItems: [],
      activeQueue: [],
      processedActionIds: []
    });
  });

  it("keeps MemoryQueueRepository processed ids unique under repeated mark calls", async () => {
    const repository = new MemoryQueueRepository();
    const reminder = action("create-reminder", "card-1");

    await repository.markActionsProcessed([reminder, reminder]);
    await repository.markActionsProcessed([reminder, action("create-calendar-event", "event-1")]);

    await expect(repository.readSnapshot(now)).resolves.toMatchObject({
      processedActionIds: ["create-reminder:card-1:2026", "create-calendar-event:event-1:2026"]
    });
  });

  it("upserts and removes push subscriptions through the JSON repository", async () => {
    const filePath = join(baseDir, "push", "subscriptions.json");
    const repository = new JsonFilePushSubscriptionRepository(filePath);

    await repository.upsert(subscription({ id: "original", endpoint: "https://push.example.test/shared" }));
    await repository.upsert(
      subscription({
        id: "replacement",
        endpoint: "https://push.example.test/shared",
        keys: { p256dh: "new-key", auth: "new-auth" }
      })
    );
    await repository.upsert(subscription({ id: "second", endpoint: "https://push.example.test/two" }));

    expect(await repository.listActive()).toEqual([
      expect.objectContaining({
        id: "original",
        endpoint: "https://push.example.test/shared",
        keys: { p256dh: "new-key", auth: "new-auth" }
      }),
      expect.objectContaining({ id: "second" })
    ]);

    await repository.remove("original");

    expect(await repository.listActive()).toEqual([expect.objectContaining({ id: "second" })]);
  });

  it("dispatches web-push and ICS providers while preserving failed provider actions in results", async () => {
    const pushRepository = new JsonFilePushSubscriptionRepository(join(baseDir, "push", "subscriptions.json"));
    await pushRepository.upsert(subscription());
    const sendNotification = vi
      .fn()
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(new Error("push transport down"));
    const client: WebPushClient = {
      setVapidDetails: vi.fn(),
      sendNotification
    };
    const ports: Pick<BackendPorts, "notifications" | "calendar"> = {
      notifications: createWebPushNotificationProvider({
        config: {
          subject: "mailto:admin@example.com",
          publicKey: "public-vapid-key",
          privateKey: "private-vapid-key",
          defaultUrl: "https://next-card.example/deck"
        },
        client,
        subscriptionRepository: pushRepository
      }),
      calendar: createIcsCalendarProvider({
        outputDir: join(baseDir, "calendar"),
        productId: "next-card/stress-test",
        calendarName: "Next Card Stress"
      })
    };

    const results = await dispatchProviderActions(
      [
        action("create-reminder", "card-1", { title: "出门去高数课" }),
        action("create-calendar-event", "course-1", {
          title: "高数课",
          payload: {
            description: "Next Card 自动插入的课程事件。",
            location: "二教 304",
            durationMinutes: 45,
            reminderMinutesBefore: 10
          }
        }),
        action("update-reminder", "card-2", { title: "补交作业提醒" })
      ],
      ports
    );

    expect(results).toEqual([
      expect.objectContaining({ actionId: "create-reminder:card-1:2026", provider: "notification", status: "scheduled" }),
      expect.objectContaining({ actionId: "create-calendar-event:course-1:2026", provider: "calendar", status: "created" }),
      expect.objectContaining({
        actionId: "update-reminder:card-2:2026",
        provider: "notification",
        status: "failed",
        error: "push transport down"
      })
    ]);
    expect(sendNotification).toHaveBeenCalledTimes(2);

    const icsPath = results.find((result) => result.provider === "calendar")?.filePath ?? "";
    const ics = await readFile(icsPath, "utf8");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:高数课");
    expect(ics).toContain("DESCRIPTION:Next Card 自动插入的课程事件。");
    expect(ics).toContain("LOCATION:二教 304");
    expect(ics).toContain("UID:course-1@next-card.local");
    expect(ics).toContain("BEGIN:VALARM");
  });
});

import { describe, expect, it } from "vitest";
import { applyBackendWorkerTick, runBackendWorkerTick } from "@/lib/server/backend-worker";
import { getProcessableProviderActions } from "@/lib/server/provider-dispatch";
import type { BackendWorkerSnapshot, QueueItem } from "@/lib/types";

const now = "2026-05-17T12:00:00.000Z";

describe("backend worker", () => {
  it("applies emitted queue actions before persisting the next snapshot", () => {
    const snapshot = workerSnapshot({
      queueItems: [queueItem("card-a", { urgencyStage: "hot" })],
      activeQueue: []
    });
    const result = runBackendWorkerTick(snapshot);
    const next = applyBackendWorkerTick(snapshot, result);

    expect(next.activeQueue).toContain("card-a");
    expect(next.queueItems.find((item) => item.id === "card-a")?.status).toBe("active");
    expect(next.processedActionIds).toEqual(expect.arrayContaining(result.actions.map((action) => action.id)));
  });

  it("does not mark future reminders processed before their scheduled window", () => {
    const future = "2026-05-17T13:00:00.000Z";
    const snapshot = workerSnapshot({
      queueItems: [queueItem("future-reminder", { reminderSync: "wanted", suggestedStartAt: future })],
      activeQueue: ["future-reminder"]
    });
    const result = runBackendWorkerTick(snapshot);
    const dueProviderActions = getProcessableProviderActions(result.actions, now);
    const next = applyBackendWorkerTick(snapshot, result, [
      ...result.actions.filter((action) => action.kind !== "create-reminder" && action.kind !== "update-reminder"),
      ...dueProviderActions
    ]);
    const futureReminderAction = result.actions.find((action) => action.kind === "create-reminder");

    expect(futureReminderAction?.scheduledFor).toBe(future);
    expect(dueProviderActions.some((action) => action.id === futureReminderAction?.id)).toBe(false);
    expect(next.processedActionIds).not.toContain(futureReminderAction?.id);
  });
});

function workerSnapshot(overrides: Partial<BackendWorkerSnapshot>): BackendWorkerSnapshot {
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

function queueItem(id: string, overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id,
    title: id,
    kind: "card",
    status: "queued",
    source: "text",
    createdAt: now,
    estimatedMinutes: 10,
    urgencyStage: "warm",
    timeLocks: [],
    ...overrides
  };
}

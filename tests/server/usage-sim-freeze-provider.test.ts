import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchProviderActions } from "@/lib/server/provider-dispatch";
import { MemoryQueueRepository } from "@/lib/server/queue-repository";
import { runBackendWorkerTick } from "@/lib/server/backend-worker";
import { createIcsCalendarProvider } from "@/lib/server/providers/ics-calendar-provider";
import { createWebPushNotificationProvider } from "@/lib/server/providers/web-push-notification-provider";
import type { BackendPorts } from "@/lib/server/backend-ports";
import type { BackendWorkerSnapshot, FrozenTaskEntry, QueueAction, QueueItem, TaskCard, TimeLock } from "@/lib/types";

const baseDir = join(tmpdir(), "next-card-usage-sim-freeze-provider", `${process.pid}`);
const createdAt = "2026-05-17T08:00:00.000Z";

function taskCard(overrides: Partial<TaskCard> = {}): TaskCard {
  return {
    id: overrides.id ?? "frozen-card",
    deckId: overrides.deckId ?? "deck-freeze",
    agentId: overrides.agentId ?? "freeze-return",
    agentName: overrides.agentName ?? "冻结回归 agent",
    flowNodeId: overrides.flowNodeId ?? "node-return",
    title: overrides.title ?? "补回实验报告上下文",
    action: overrides.action ?? "打开报告草稿，只补一句能继续写的上下文。",
    estimatedMinutes: overrides.estimatedMinutes ?? 12,
    deadlineAt: overrides.deadlineAt ?? "2026-05-17T12:00:00.000Z",
    suggestedStartAt: overrides.suggestedStartAt ?? null,
    startedAt: overrides.startedAt ?? null,
    elapsedSeconds: overrides.elapsedSeconds ?? 0,
    remainingSeconds: overrides.remainingSeconds ?? null,
    urgencyStage: overrides.urgencyStage ?? "warm",
    damageEffect: overrides.damageEffect ?? "freeze",
    damageProgress: overrides.damageProgress ?? 25,
    burnLevel: overrides.burnLevel ?? 0,
    status: overrides.status ?? "frozen",
    encouragement: overrides.encouragement ?? "只要接回上下文即可。",
    cardBackNote: overrides.cardBackNote ?? "冻结时已保存草稿位置。"
  };
}

function frozenTask(overrides: Partial<FrozenTaskEntry> = {}): FrozenTaskEntry {
  return {
    id: overrides.id ?? "freeze-entry-1",
    card: overrides.card ?? taskCard(),
    deckTitle: overrides.deckTitle ?? "实验报告",
    frozenAt: overrides.frozenAt ?? "2026-05-17T08:10:00.000Z",
    returnAfter: overrides.returnAfter ?? "2026-05-17T09:40:00.000Z",
    reason: overrides.reason ?? "用户选择先冻结。",
    minReentryMinutes: overrides.minReentryMinutes ?? 6,
    contextSnapshot: overrides.contextSnapshot ?? ["草稿在第二段", "下一步补一句方法说明"]
  };
}

function queueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: overrides.id ?? "queue-card",
    title: overrides.title ?? "队列任务",
    kind: overrides.kind ?? "card",
    status: overrides.status ?? "queued",
    source: overrides.source ?? "text",
    createdAt: overrides.createdAt ?? createdAt,
    estimatedMinutes: overrides.estimatedMinutes ?? 8,
    deadlineAt: overrides.deadlineAt,
    suggestedStartAt: overrides.suggestedStartAt,
    urgencyStage: overrides.urgencyStage ?? "warm",
    position: overrides.position,
    deckId: overrides.deckId,
    cardId: overrides.cardId,
    hidden: overrides.hidden,
    calendarSync: overrides.calendarSync,
    reminderSync: overrides.reminderSync,
    frozenAt: overrides.frozenAt,
    returnAfter: overrides.returnAfter,
    behaviorVector: overrides.behaviorVector,
    timeLocks: overrides.timeLocks ?? []
  };
}

function timeLock(overrides: Partial<TimeLock> = {}): TimeLock {
  return {
    id: overrides.id ?? "hard-lock-1",
    targetId: overrides.targetId ?? "locked-class",
    targetType: overrides.targetType ?? "calendar-event",
    kind: overrides.kind ?? "notebook-fixed",
    strength: overrides.strength ?? "hard",
    startsAt: overrides.startsAt ?? "2026-05-17T10:30:00.000Z",
    endsAt: overrides.endsAt ?? "2026-05-17T11:15:00.000Z",
    lockedAt: overrides.lockedAt ?? createdAt,
    reason: overrides.reason ?? "用户固定课程时间，agent 不能静默移动。",
    canAgentMove: overrides.canAgentMove ?? false,
    canAgentSuggest: overrides.canAgentSuggest ?? true
  };
}

function snapshot(overrides: Partial<BackendWorkerSnapshot> = {}): BackendWorkerSnapshot {
  return {
    now: overrides.now ?? "2026-05-17T09:00:00.000Z",
    queueItems: overrides.queueItems ?? [],
    activeQueue: overrides.activeQueue ?? [],
    timeLocks: overrides.timeLocks ?? [],
    frozenTasks: overrides.frozenTasks ?? [],
    hiddenGoals: overrides.hiddenGoals ?? [],
    processedActionIds: overrides.processedActionIds ?? []
  };
}

function providerPorts(outputDir: string): Pick<BackendPorts, "notifications" | "calendar"> {
  return {
    notifications: createWebPushNotificationProvider({
      config: {
        subject: "",
        publicKey: "",
        privateKey: ""
      },
      client: {
        setVapidDetails: vi.fn(),
        sendNotification: vi.fn()
      },
      subscriptionRepository: {
        async listActive() {
          return [
            {
              id: "sub-1",
              endpoint: "https://push.example.test/local",
              keys: { p256dh: "p256dh", auth: "auth" },
              createdAt
            }
          ];
        },
        async remove() {}
      }
    }),
    calendar: createIcsCalendarProvider({
      outputDir,
      productId: "next-card/usage-sim",
      calendarName: "Next Card Usage Sim",
      defaultDurationMinutes: 25
    })
  };
}

describe("usage simulation: freeze return with providers and worker actions", () => {
  beforeEach(async () => {
    await rm(baseDir, { force: true, recursive: true });
    await mkdir(baseDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(baseDir, { force: true, recursive: true });
  });

  it("keeps frozen cards in the backend queue, waits behind urgent work, then returns or splits when the window opens", async () => {
    const repository = new MemoryQueueRepository();
    const frozen = frozenTask({
      card: taskCard({
        id: "frozen-report",
        title: "补回实验报告上下文",
        estimatedMinutes: 22,
        deadlineAt: "2026-05-17T12:30:00.000Z"
      })
    });

    await repository.writeSnapshot(snapshot({ now: "2026-05-17T09:00:00.000Z", frozenTasks: [frozen] }));

    const earlySnapshot = await repository.readSnapshot("2026-05-17T09:00:00.000Z");
    const earlyTick = runBackendWorkerTick(earlySnapshot);

    expect(earlyTick.freezeDecisions[0].action).toMatchObject({
      kind: "keep-waiting",
      targetId: "frozen-report",
      scheduledFor: "2026-05-17T09:40:00.000Z"
    });
    expect(earlyTick.freezeDecisions[0].restoredCard).toBeUndefined();
    expect(earlyTick.actions).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: "create-reminder" })]));
    await repository.markActionsProcessed(earlyTick.actions);

    const urgentCurrent = queueItem({
      id: "exam-upload",
      title: "先上传考试材料",
      deadlineAt: "2026-05-17T09:55:00.000Z",
      urgencyStage: "burning",
      behaviorVector: {
        expectancy: 82,
        taskValue: 100,
        procrastination: 12,
        timePressure: 100,
        reasons: ["当前队列有不可错过任务。"]
      }
    });
    await repository.writeSnapshot(
      snapshot({
        now: "2026-05-17T09:45:00.000Z",
        queueItems: [urgentCurrent],
        activeQueue: ["exam-upload"],
        frozenTasks: [frozen],
        processedActionIds: earlyTick.actions.map((action) => action.id)
      })
    );

    const urgentTick = runBackendWorkerTick(await repository.readSnapshot("2026-05-17T09:45:00.000Z"));

    expect(urgentTick.freezeDecisions[0].action).toMatchObject({
      kind: "create-reminder",
      targetId: "frozen-report",
      scheduledFor: "2026-05-17T10:15:00.000Z"
    });
    expect(urgentTick.freezeDecisions[0].restoredCard).toBeUndefined();
    expect(urgentTick.freezeDecisions[0].reason).toContain("更急");
    expect(urgentTick.actions).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "deal-card", targetId: "exam-upload" })]));
    expect(urgentTick.actions).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: "return-frozen-card" })]));
    await repository.markActionsProcessed(urgentTick.actions);

    const clearTick = runBackendWorkerTick(
      snapshot({
        now: "2026-05-17T10:20:00.000Z",
        queueItems: [],
        frozenTasks: [
          frozenTask({
            card: taskCard({
              id: "frozen-report",
              title: "补回实验报告上下文",
              estimatedMinutes: 24,
              deadlineAt: "2026-05-17T10:55:00.000Z"
            }),
            minReentryMinutes: 5
          })
        ],
        processedActionIds: [...earlyTick.actions, ...urgentTick.actions].map((action) => action.id)
      })
    );

    expect(clearTick.freezeDecisions[0]).toEqual(
      expect.objectContaining({
        action: expect.objectContaining({
          kind: "split-frozen-card",
          targetId: "frozen-report"
        }),
        restoredCard: expect.objectContaining({
          id: "frozen-report",
          title: expect.stringContaining("回归"),
          estimatedMinutes: 5,
          status: "active",
          damageEffect: "none",
          suggestedStartAt: "2026-05-17T10:20:00.000Z"
        })
      })
    );
  });

  it("dispatches real provider shapes from worker actions while hard locks stay fixed", async () => {
    const lockedClass = queueItem({
      id: "locked-class",
      title: "10:30 固定高数课",
      kind: "calendar-event",
      deadlineAt: "2026-05-17T10:30:00.000Z",
      suggestedStartAt: "2026-05-17T10:30:00.000Z",
      urgencyStage: "burning",
      position: 0,
      calendarSync: "wanted",
      timeLocks: [timeLock({ id: "class-lock-inline", targetId: "locked-class" })]
    });
    const updateCalendar = queueItem({
      id: "review-calendar",
      title: "复盘块更新到日历",
      kind: "calendar-event",
      deadlineAt: "2026-05-17T11:30:00.000Z",
      suggestedStartAt: "2026-05-17T11:00:00.000Z",
      urgencyStage: "hot",
      calendarSync: "synced"
    });
    const wantedReminder = queueItem({
      id: "reminder-create",
      title: "出门前检查教材",
      deadlineAt: "2026-05-17T10:15:00.000Z",
      suggestedStartAt: "2026-05-17T10:05:00.000Z",
      urgencyStage: "hot",
      reminderSync: "wanted"
    });
    const syncedReminder = queueItem({
      id: "reminder-update",
      title: "更新实验服提醒",
      deadlineAt: "2026-05-17T10:18:00.000Z",
      suggestedStartAt: "2026-05-17T10:08:00.000Z",
      urgencyStage: "hot",
      reminderSync: "synced"
    });
    const hiddenGoal = queueItem({
      id: "hidden-pack",
      title: "隐藏的课程资料包",
      kind: "hidden-goal",
      status: "hidden",
      hidden: true,
      deadlineAt: "2026-05-17T10:35:00.000Z",
      urgencyStage: "hot"
    });
    const globalLock = timeLock({ id: "class-lock-global", targetId: "locked-class" });
    const tick = runBackendWorkerTick(
      snapshot({
        now: "2026-05-17T10:00:00.000Z",
        queueItems: [lockedClass, updateCalendar, wantedReminder, syncedReminder],
        activeQueue: ["locked-class", "review-calendar", "reminder-create", "reminder-update"],
        hiddenGoals: [hiddenGoal],
        timeLocks: [globalLock]
      })
    );

    expect(tick.schedule.lockedConflicts).toEqual([
      expect.objectContaining({ targetId: "locked-class", lockId: "class-lock-inline", suggestedAction: "suggest-only" }),
      expect.objectContaining({ targetId: "locked-class", lockId: "class-lock-global", suggestedAction: "suggest-only" })
    ]);
    expect(tick.actions).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: "move-task", targetId: "locked-class" })]));
    expect(tick.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "create-calendar-event", targetId: "locked-class", respectsLocks: true }),
        expect.objectContaining({ kind: "update-calendar-event", targetId: "review-calendar" }),
        expect.objectContaining({ kind: "create-reminder", targetId: "reminder-create" }),
        expect.objectContaining({ kind: "update-reminder", targetId: "reminder-update" }),
        expect.objectContaining({ kind: "deal-card" }),
        expect.objectContaining({ kind: "reveal-hidden-goal", targetId: "hidden-pack", requiresUserReview: true })
      ])
    );

    const providerActions = tick.actions
      .filter((action) =>
        ["create-reminder", "update-reminder", "create-calendar-event", "update-calendar-event"].includes(action.kind)
      )
      .map((action): QueueAction => {
        if (action.kind === "create-calendar-event" || action.kind === "update-calendar-event") {
          return {
            ...action,
            payload: {
              description: `provider payload for ${action.targetId}`,
              location: action.targetId === "locked-class" ? "二教 304" : "图书馆",
              durationMinutes: action.targetId === "locked-class" ? 45 : 25,
              reminderMinutesBefore: 10
            }
          };
        }

        return action;
      });
    const ports = providerPorts(join(baseDir, "calendar"));
    const dispatchResults = await dispatchProviderActions(providerActions, ports);

    expect(dispatchResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "notification", targetId: "reminder-create", status: "failed", error: "Missing Web Push VAPID configuration" }),
        expect.objectContaining({ provider: "notification", targetId: "reminder-update", status: "failed", error: "Missing Web Push VAPID configuration" }),
        expect.objectContaining({ provider: "calendar", targetId: "locked-class", status: "created", providerId: "ics:locked-class" }),
        expect.objectContaining({ provider: "calendar", targetId: "review-calendar", status: "updated", providerId: "ics:review-calendar" })
      ])
    );

    const createCalendarPath =
      dispatchResults.find((result) => result.provider === "calendar" && result.targetId === "locked-class")?.filePath ?? "";
    const updateCalendarPath =
      dispatchResults.find((result) => result.provider === "calendar" && result.targetId === "review-calendar")?.filePath ?? "";
    const createdIcs = await readFile(createCalendarPath, "utf8");
    const updatedIcs = await readFile(updateCalendarPath, "utf8");

    expect(createdIcs).toContain("SUMMARY:10:30 固定高数课");
    expect(createdIcs).toContain("DESCRIPTION:provider payload for locked-class");
    expect(createdIcs).toContain("LOCATION:二教 304");
    expect(createdIcs).toContain("UID:locked-class@next-card.local");
    expect(updatedIcs).toContain("SUMMARY:复盘块更新到日历");
    expect(updatedIcs).toContain("DESCRIPTION:provider payload for review-calendar");
    expect(updatedIcs).toContain("UID:review-calendar@next-card.local");
  });
});

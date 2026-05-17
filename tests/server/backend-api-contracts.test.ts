import { describe, expect, it, vi } from "vitest";
import { GET as healthGet } from "@/app/api/backend/health/route";
import { POST as calendarPost } from "@/app/api/backend/calendar/events/route";
import { POST as freezeReturnPost } from "@/app/api/backend/freeze/return/route";
import { POST as importReviewPost } from "@/app/api/backend/import/review/route";
import { POST as planModePost } from "@/app/api/backend/plan-mode/route";
import { GET as pushPublicKeyGet } from "@/app/api/backend/push/public-key/route";
import { POST as pushSendPost } from "@/app/api/backend/push/send/route";
import { POST as pushSubscriptionsPost } from "@/app/api/backend/push/subscriptions/route";
import { POST as schedulePlanPost } from "@/app/api/backend/schedule/plan/route";
import { POST as workerTickPost } from "@/app/api/backend/worker/tick/route";
import type { FrozenTaskEntry, QueueAction, QueueItem, TaskCard } from "@/lib/types";

const now = "2026-05-17T10:00:00.000Z";

function request(body: unknown) {
  return new Request("http://next-card.test/api/backend", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" }
  });
}

function queueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: overrides.id ?? "go-to-math",
    title: overrides.title ?? "整理课本并出门去高数课",
    kind: overrides.kind ?? "card",
    status: overrides.status ?? "queued",
    source: overrides.source ?? "text",
    createdAt: overrides.createdAt ?? "2026-05-17T09:40:00.000Z",
    estimatedMinutes: overrides.estimatedMinutes ?? 8,
    deadlineAt: overrides.deadlineAt ?? "2026-05-17T10:25:00.000Z",
    suggestedStartAt: overrides.suggestedStartAt,
    urgencyStage: overrides.urgencyStage ?? "hot",
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

function taskCard(overrides: Partial<TaskCard> = {}): TaskCard {
  return {
    id: overrides.id ?? "frozen-card",
    deckId: overrides.deckId ?? "deck-math",
    agentId: overrides.agentId ?? "gentle-recovery",
    agentName: overrides.agentName ?? "温和恢复师",
    flowNodeId: overrides.flowNodeId ?? "flow-prepare",
    title: overrides.title ?? "恢复去高数课准备",
    action: overrides.action ?? "只检查书包里是否有课本和上次作业页。",
    estimatedMinutes: overrides.estimatedMinutes ?? 6,
    deadlineAt: overrides.deadlineAt ?? "2026-05-17T10:30:00.000Z",
    suggestedStartAt: overrides.suggestedStartAt ?? now,
    startedAt: overrides.startedAt ?? null,
    elapsedSeconds: overrides.elapsedSeconds ?? 0,
    remainingSeconds: overrides.remainingSeconds ?? null,
    urgencyStage: overrides.urgencyStage ?? "warm",
    damageEffect: overrides.damageEffect ?? "freeze",
    damageProgress: overrides.damageProgress ?? 20,
    burnLevel: overrides.burnLevel ?? 0,
    status: overrides.status ?? "frozen",
    encouragement: overrides.encouragement ?? "重新接回即可。",
    cardBackNote: overrides.cardBackNote ?? "冻结上下文已保存。"
  };
}

function frozenEntry(overrides: Partial<FrozenTaskEntry> = {}): FrozenTaskEntry {
  return {
    id: overrides.id ?? "freeze-1",
    card: overrides.card ?? taskCard(),
    deckTitle: overrides.deckTitle ?? "去高数课",
    frozenAt: overrides.frozenAt ?? "2026-05-17T09:30:00.000Z",
    returnAfter: overrides.returnAfter ?? "2026-05-17T09:50:00.000Z",
    reason: overrides.reason ?? "用户选择先冻结。",
    minReentryMinutes: overrides.minReentryMinutes ?? 6,
    contextSnapshot: overrides.contextSnapshot ?? ["课本待检查", "下一步是出门准备"]
  };
}

function queueAction(overrides: Partial<QueueAction> = {}): QueueAction {
  return {
    id: overrides.id ?? "no-op:card-1",
    kind: overrides.kind ?? "no-op",
    targetId: overrides.targetId ?? "card-1",
    title: overrides.title ?? "合同测试动作",
    priority: overrides.priority ?? 10,
    position: overrides.position,
    scheduledFor: overrides.scheduledFor,
    payload: overrides.payload,
    reason: overrides.reason ?? "用于 API route 合同测试。",
    confidence: overrides.confidence ?? 0.8,
    requiresUserReview: overrides.requiresUserReview ?? false,
    respectsLocks: overrides.respectsLocks ?? true,
    createdAt: overrides.createdAt ?? now
  };
}

describe("backend API route contracts", () => {
  it("reports backend capabilities and Mimo configuration without leaking tokens", async () => {
    vi.stubEnv("MIMO_API_KEY", "mimo-secret-token");
    vi.stubEnv("MIMO_PLANNER_MODEL", "planner-contract-model");
    vi.stubEnv("MIMO_MULTIMODAL_MODEL", "multimodal-contract-model");

    const body = await healthGet().json();

    expect(body.status).toBe("ok");
    expect(body.capabilities).toEqual(
      expect.arrayContaining(["plan-mode", "import-review", "schedule-planner", "worker-tick"])
    );
    expect(body.providers.ai).toMatchObject({
      kind: "mimo-openai-compatible",
      configured: true,
      plannerModel: "planner-contract-model",
      multimodalModel: "multimodal-contract-model"
    });
    expect(JSON.stringify(body)).not.toContain("mimo-secret-token");
    expect(JSON.stringify(body)).not.toContain("MIMO_API_KEY");
  });

  it("validates Plan Mode requests and returns the Codex-like planning shape", async () => {
    await expect(planModePost(request({ sourceType: "text" })).then((response) => response.status)).resolves.toBe(400);
    await expect(planModePost(request({ inputText: "   ", sourceType: "text" })).then((response) => response.status)).resolves.toBe(400);

    const response = await planModePost(request({ inputText: "去高数课", sourceType: "text" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toMatch(/ready-to-build|needs-supplement|needs-review/);
    expect(body.analysis.goalUnderstanding).toContain("去高数课");
    expect(body.analysis.knownConstraints).toEqual(expect.any(Array));
    expect(body.options).toHaveLength(4);
    expect(body.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "plan-1", label: "方案一", kind: "build", planId: "plan-1" }),
        expect.objectContaining({ id: "plan-2", label: "方案二", kind: "build", planId: "plan-2" }),
        expect.objectContaining({ id: "plan-3", label: "方案三", kind: "build", planId: "plan-3" }),
        expect.objectContaining({ id: "supplement", kind: "supplement" })
      ])
    );
  });

  it("validates multimodal import review requests and returns review coverage without OCR wording", async () => {
    await expect(importReviewPost(request({ sourceType: "image" })).then((response) => response.status)).resolves.toBe(400);
    await expect(importReviewPost(request({ sourceType: "image", rawText: "  " })).then((response) => response.status)).resolves.toBe(400);

    const response = await importReviewPost(
      request({ sourceType: "image", rawText: "周一 08:00 高数\n周三 23:00 前提交实验报告" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reviewRequired).toBe(true);
    expect(body.topLevelCards.length).toBeGreaterThanOrEqual(2);
    expect(body.coverageChecks).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "timetable-line-count" })]));
    expect(JSON.stringify(body).toLowerCase()).not.toContain("ocr");
  });

  it("accepts direct image payloads only when a real multimodal provider can inspect them", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("MIMO_API_KEY", "");
    vi.stubEnv("NEXT_CARD_MIMO_API_KEY", "");
    vi.stubEnv("MIMO_OPENAI_API_KEY", "");

    const response = await importReviewPost(
      request({
        sourceType: "image",
        imageDataUrl: "data:image/jpeg;base64,aW1hZ2UtYnl0ZXM=",
        attachmentName: "real-timetable.jpg"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("configured multimodal provider");
  });

  it("keeps schedule planning route thin while preserving hard-lock review boundaries", async () => {
    const locked = queueItem({
      id: "fixed-class",
      kind: "calendar-event",
      title: "10:25 高数课",
      deadlineAt: "2026-05-17T10:25:00.000Z"
    });

    await expect(schedulePlanPost(request({ activeQueue: [] })).then((response) => response.status)).resolves.toBe(400);

    const response = await schedulePlanPost(
      request({
        now,
        items: [locked],
        activeQueue: [locked.id],
        timeLocks: [
          {
            id: "lock-fixed-class",
            targetId: locked.id,
            targetType: "calendar-event",
            kind: "notebook-fixed",
            strength: "hard",
            startsAt: "2026-05-17T10:20:00.000Z",
            endsAt: "2026-05-17T11:10:00.000Z",
            lockedAt: "2026-05-17T09:00:00.000Z",
            reason: "用户固定课程时间。",
            canAgentMove: false,
            canAgentSuggest: true
          }
        ],
        maxDealCards: 2
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.generatedAt).toBe(now);
    expect(body.priorityVectors[locked.id]).toEqual(expect.objectContaining({ userLockPenalty: expect.any(Number) }));
    expect(body.lockedConflicts).toEqual(expect.arrayContaining([expect.objectContaining({ targetId: locked.id })]));
    expect(body.actions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "move-task", targetId: locked.id })])
    );
  });

  it("validates freeze-return requests and restores frozen cards through an explicit queue action", async () => {
    await expect(freezeReturnPost(request({ currentQueue: [] })).then((response) => response.status)).resolves.toBe(400);

    const response = await freezeReturnPost(request({ now, entry: frozenEntry(), currentQueue: [] }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.action).toEqual(
      expect.objectContaining({
        kind: expect.stringMatching(/return-frozen-card|split-frozen-card|create-reminder/),
        targetId: "frozen-card",
        respectsLocks: true
      })
    );
    expect(body.priorityVector).toEqual(expect.objectContaining({ score: expect.any(Number) }));
  });

  it("runs worker ticks from an explicit snapshot and dispatches provider actions as route output", async () => {
    const calendarItem = queueItem({
      id: "calendar-card",
      kind: "calendar-event",
      title: "高数课提醒",
      suggestedStartAt: "2026-05-17T10:20:00.000Z",
      deadlineAt: null,
      calendarSync: "wanted"
    });

    const response = await workerTickPost(
      request({
        now,
        queueItems: [calendarItem],
        activeQueue: [calendarItem.id],
        timeLocks: [],
        frozenTasks: [],
        hiddenGoals: [],
        processedActionIds: []
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tickId).toContain("worker-2026-05-17T10-00-00");
    expect(body.actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "create-calendar-event", targetId: calendarItem.id })])
    );
    expect(body.dispatchResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "calendar", status: expect.stringMatching(/created|updated|skipped|failed/) })
      ])
    );
  });

  it("validates calendar and push action routes and returns provider-shaped results", async () => {
    await expect(calendarPost(request({ kind: "create-calendar-event" })).then((response) => response.status)).resolves.toBe(400);
    await expect(pushSendPost(request({ kind: "create-reminder" })).then((response) => response.status)).resolves.toBe(400);

    const calendarResponse = await calendarPost(request(queueAction({ kind: "no-op" })));
    const calendarBody = await calendarResponse.json();
    const pushResponse = await pushSendPost(request(queueAction({ kind: "no-op" })));
    const pushBody = await pushResponse.json();

    expect(calendarResponse.status).toBe(200);
    expect(calendarBody).toEqual(expect.objectContaining({ providerId: "ics:card-1", status: "skipped" }));
    expect(pushResponse.status).toBe(200);
    expect(pushBody).toEqual(
      expect.objectContaining({ providerId: "web-push:card-1", status: "skipped", sentCount: 0, failedCount: 0 })
    );
  });

  it("exposes only public push setup data and validates subscription payloads", async () => {
    vi.stubEnv("NEXT_CARD_PUSH_VAPID_PUBLIC_KEY", "public-vapid-key");
    vi.stubEnv("NEXT_CARD_PUSH_VAPID_PRIVATE_KEY", "private-vapid-secret");

    const publicKeyBody = await pushPublicKeyGet().json();

    expect(publicKeyBody).toEqual({ configured: true, publicKey: "public-vapid-key" });
    expect(JSON.stringify(publicKeyBody)).not.toContain("private-vapid-secret");

    const invalid = await pushSubscriptionsPost(request({ endpoint: "https://push.example.test/sub", keys: { p256dh: "" } }));
    const valid = await pushSubscriptionsPost(
      request({
        endpoint: "https://push.example.test/sub",
        keys: { p256dh: "p256dh", auth: "auth" }
      })
    );
    const validBody = await valid.json();

    expect(invalid.status).toBe(400);
    expect(valid.status).toBe(200);
    expect(validBody).toEqual(expect.objectContaining({ status: "saved", id: expect.any(String) }));
  });
});

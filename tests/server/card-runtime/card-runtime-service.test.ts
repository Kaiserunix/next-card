import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { createCommittedDeckHarness } from "@/tests/server/card-runtime/test-utils";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("CardRuntimeService", () => {
  it("starts and completes a committed card while appending Card Runtime proof", async () => {
    const harness = await createCommittedDeckHarness("plan-b", { get current() { return tempDir; }, set current(value) { tempDir = value; } });
    const card = harness.cards[0];

    const started = await harness.runtimeService.applyAction({
      requestId: "card_req_start_1",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "start",
      clientContext: { now: "2026-05-22T09:05:00.000Z", timezone: "Asia/Shanghai" },
    });
    const completed = await harness.runtimeService.applyAction({
      requestId: "card_req_complete_1",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "complete",
      actualMinutes: 6,
      clientContext: { now: "2026-05-22T09:11:00.000Z", timezone: "Asia/Shanghai" },
    });

    expect(started.cardRuntimeState.status).toBe("active");
    expect(completed.cardRuntimeState.status).toBe("completed");
    expect(completed.proofEvents[0]).toMatchObject({
      type: "card_completed",
      sourceService: "card-runtime",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
    });
    expect((await harness.ledger.getTimeline()).events.map((event) => event.type)).toEqual([
      "deck_committed",
      "card_started",
      "card_completed",
    ]);
  });

  it("is idempotent for duplicate requestId values", async () => {
    const harness = await createCommittedDeckHarness("plan-b", { get current() { return tempDir; }, set current(value) { tempDir = value; } });
    const card = harness.cards[0];
    const request = {
      requestId: "card_req_complete_idempotent",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "complete",
      actualMinutes: 5,
      clientContext: { now: "2026-05-22T09:10:00.000Z", timezone: "Asia/Shanghai" },
    };

    const first = await harness.runtimeService.applyAction(request);
    const second = await harness.runtimeService.applyAction(request);

    expect(first.proofEvents[0].id).toBe(second.proofEvents[0].id);
    expect((await harness.ledger.getTimeline()).events.filter((event) => event.type === "card_completed")).toHaveLength(1);
    expect(second.boundaryWarnings).toContain("idempotent-replay: duplicate requestId returned existing result");
  });

  it("rejects requestId reuse for a different deck/card/action tuple", async () => {
    const harness = await createCommittedDeckHarness("plan-b", { get current() { return tempDir; }, set current(value) { tempDir = value; } });
    const firstCard = harness.cards[0];
    const secondCard = harness.cards[1];

    await harness.runtimeService.applyAction({
      requestId: "card_req_idempotency_conflict",
      deckId: harness.deck.deckId,
      cardId: firstCard.cardId,
      action: "complete",
      actualMinutes: 5,
      clientContext: { now: "2026-05-22T09:10:00.000Z", timezone: "Asia/Shanghai" },
    });

    await expect(
      harness.runtimeService.applyAction({
        requestId: "card_req_idempotency_conflict",
        deckId: harness.deck.deckId,
        cardId: secondCard.cardId,
        action: "freeze",
        clientContext: { now: "2026-05-22T09:11:00.000Z", timezone: "Asia/Shanghai" },
      }),
    ).rejects.toMatchObject({
      code: "CARD_RUNTIME_IDEMPOTENCY_CONFLICT",
      status: 409,
    });
    expect((await harness.ledger.getTimeline()).events.filter((event) => event.type === "card_completed")).toHaveLength(1);
  });

  it("freezes without deleting the committed card and returns a Time Guardian review action", async () => {
    const harness = await createCommittedDeckHarness("plan-c", { get current() { return tempDir; }, set current(value) { tempDir = value; } });
    const card = harness.cards[1];

    const frozen = await harness.runtimeService.applyAction({
      requestId: "card_req_freeze_1",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "freeze",
      reason: "先保存上下文，晚点继续",
      clientContext: { now: "2026-05-22T09:20:00.000Z", timezone: "Asia/Shanghai" },
    });

    expect(frozen.cardRuntimeState.status).toBe("frozen");
    expect(frozen.timeGuardianActions[0]).toMatchObject({ type: "freeze-card", cardId: card.cardId });
    expect(await harness.deckRepository.listCardsByDeck(harness.deck.deckId)).toHaveLength(3);
    expect((await harness.ledger.getTimeline()).events.map((event) => event.type)).toContain("card_frozen");
  });

  it("rejects freeze when its Time Guardian queue action fails validation", async () => {
    const harness = await createCommittedDeckHarness("plan-c", { get current() { return tempDir; }, set current(value) { tempDir = value; } });
    const card = harness.cards[1];

    const frozen = await harness.runtimeService.applyAction({
      requestId: "card_req_freeze_invalid_queue_action",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "freeze",
      reason: " ",
      clientContext: { now: "2026-05-22T09:20:00.000Z", timezone: "Asia/Shanghai" },
    });

    expect(frozen.cardRuntimeState.status).toBe("queued");
    expect(frozen.timeGuardianActions[0]).toMatchObject({ type: "request-user-review" });
    expect(frozen.proofEvents).toEqual([]);
    expect(frozen.boundaryWarnings.some((warning) => warning.includes("action-rejected"))).toBe(true);
  });

  it("records burn as pressure feedback rather than failure", async () => {
    const harness = await createCommittedDeckHarness("plan-b", { get current() { return tempDir; }, set current(value) { tempDir = value; } });
    const card = harness.cards[0];

    await harness.runtimeService.applyAction({
      requestId: "card_req_burn_start_1",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "burn_start",
      clientContext: { now: "2026-05-22T09:20:00.000Z", timezone: "Asia/Shanghai" },
    });
    const burnComplete = await harness.runtimeService.applyAction({
      requestId: "card_req_burn_complete_1",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "burn_complete",
      clientContext: { now: "2026-05-22T09:26:00.000Z", timezone: "Asia/Shanghai" },
    });

    expect(burnComplete.cardRuntimeState.status).toBe("active");
    const copy = JSON.stringify(await harness.ledger.getTimeline());
    expect(copy).toContain("burn_completed");
    expect(copy).not.toMatch(/失败|懒|failure|lazy/i);
  });

  it("rejects unsafe defer windows that collide with hard time locks", async () => {
    const harness = await createCommittedDeckHarness("plan-b", { get current() { return tempDir; }, set current(value) { tempDir = value; } });
    const card = harness.cards[0];

    const deferred = await harness.runtimeService.applyAction({
      requestId: "card_req_defer_conflict",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "defer",
      deferToWindow: {
        id: "window_conflict",
        startAt: "2026-05-22T10:00:00.000Z",
        endAt: "2026-05-22T10:30:00.000Z",
        timezone: "Asia/Shanghai",
        source: "user-stated",
        confidence: 1,
      },
      timeLocks: [
        {
          id: "lock_class",
          userId: "anon",
          kind: "class_time",
          startAt: "2026-05-22T10:05:00.000Z",
          endAt: "2026-05-22T10:50:00.000Z",
          timezone: "Asia/Shanghai",
          movable: false,
          sourceRefs: [{ rawInputId: "raw_1", quote: "10:05 上课", confidence: 1 }],
          reviewStatus: "user-confirmed",
          conflictStatus: "none",
        },
      ],
      clientContext: { now: "2026-05-22T09:30:00.000Z", timezone: "Asia/Shanghai" },
    });

    expect(deferred.cardRuntimeState.status).toBe("queued");
    expect(deferred.timeGuardianActions[0].type).toBe("request-user-review");
    expect(deferred.proofEvents).toEqual([]);
    expect((await harness.ledger.getTimeline()).events.map((event) => event.type)).toEqual(["deck_committed"]);
  });
});

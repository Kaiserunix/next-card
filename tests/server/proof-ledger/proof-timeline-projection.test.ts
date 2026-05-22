import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { JsonFileCardRuntimeRepository } from "@/lib/server/card-runtime/card-runtime-repository";
import { projectProofTimeline } from "@/lib/server/proof-ledger/proof-timeline-projection";
import { createCommittedDeckHarness } from "@/tests/server/card-runtime/test-utils";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("projectProofTimeline", () => {
  it("projects deck commit and card completion in ledger order", async () => {
    const harness = await createHarness();
    const card = harness.cards[0];
    await harness.runtimeService.applyAction({
      requestId: "timeline_start_1",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "start",
      clientContext: { now: "2026-05-22T09:05:00.000Z", timezone: "Asia/Shanghai" },
    });
    await harness.runtimeService.applyAction({
      requestId: "timeline_complete_1",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "complete",
      actualMinutes: 5,
      clientContext: { now: "2026-05-22T09:10:00.000Z", timezone: "Asia/Shanghai" },
    });

    const timeline = await projectProofTimeline({
      ledger: harness.ledger,
      deckRepository: harness.deckRepository,
      runtimeRepository: new JsonFileCardRuntimeRepository(),
      filters: { deckId: harness.deck.deckId },
    });

    expect(timeline.entries.map((entry) => entry.type)).toEqual(["deck_committed", "card_started", "card_completed"]);
    expect(timeline.entries[2]).toMatchObject({ statusColor: "green", source: "proof-ledger" });
    expect(timeline.summary).toMatchObject({ committedDecks: 1, completedCards: 1 });
  });

  it("keeps freeze and burn copy neutral", async () => {
    const harness = await createHarness();
    const card = harness.cards[0];
    await harness.runtimeService.applyAction({
      requestId: "timeline_burn_1",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "burn_start",
      clientContext: { now: "2026-05-22T09:05:00.000Z", timezone: "Asia/Shanghai" },
    });
    await harness.runtimeService.applyAction({
      requestId: "timeline_burn_2",
      deckId: harness.deck.deckId,
      cardId: card.cardId,
      action: "burn_complete",
      clientContext: { now: "2026-05-22T09:08:00.000Z", timezone: "Asia/Shanghai" },
    });
    await harness.runtimeService.applyAction({
      requestId: "timeline_freeze_1",
      deckId: harness.deck.deckId,
      cardId: harness.cards[1].cardId,
      action: "freeze",
      clientContext: { now: "2026-05-22T09:09:00.000Z", timezone: "Asia/Shanghai" },
    });

    const timeline = await projectProofTimeline({ ledger: harness.ledger, filters: { deckId: harness.deck.deckId } });
    const copy = JSON.stringify(timeline);

    expect(timeline.entries.map((entry) => entry.type)).toEqual([
      "deck_committed",
      "burn_started",
      "burn_completed",
      "card_frozen",
    ]);
    expect(copy).not.toMatch(/懒|自律差|失败人格|failure|lazy/i);
    expect(timeline.entries.find((entry) => entry.type === "card_frozen")?.statusColor).toBe("ice");
  });

  it("projects created reminders without claiming delivery", async () => {
    const harness = await createHarness();

    await harness.ledger.appendEvent({
      id: "timeline_reminder_created_1",
      type: "reminder_created",
      deckId: harness.deck.deckId,
      actor: "system-service",
      sourceService: "time-guardian",
      createdAt: "2026-05-22T09:15:00.000Z",
      summary: "已记录课前 30 分钟提醒。",
    });

    const result = await projectProofTimeline({ ledger: harness.ledger, filters: { deckId: harness.deck.deckId } });

    expect(result.entries.at(-1)).toMatchObject({
      type: "reminder_created",
      title: "提醒已记录",
    });
    expect(result.entries.map((entry) => entry.type)).not.toContain("reminder_delivered");
  });

  it("returns an empty projection for a missing deck instead of throwing", async () => {
    const harness = await createHarness();

    const timeline = await projectProofTimeline({ ledger: harness.ledger, filters: { deckId: "deck_missing" } });

    expect(timeline.entries).toEqual([]);
    expect(timeline.summary.totalEntries).toBe(0);
  });
});

async function createHarness() {
  const sink = { current: undefined as string | undefined };
  const harness = await createCommittedDeckHarness("plan-b", sink);
  tempDir = sink.current;
  return harness;
}

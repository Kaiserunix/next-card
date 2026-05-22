import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonFileProofLedgerRepository } from "@/lib/server/proof-ledger/proof-ledger-repository";
import { createCommittedDeckHarness } from "@/tests/server/card-runtime/test-utils";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("Card Runtime boundary redteam", () => {
  it("still rejects direct card_completed writes to Proof Ledger", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-card-runtime-redteam-"));
    const ledger = new JsonFileProofLedgerRepository(join(tempDir, "proof-ledger.json"));

    await expect(
      ledger.appendEvent({
        id: "proof_fake_card_done",
        type: "card_completed",
        deckId: "deck_fake",
        cardId: "card_fake",
        actor: "system-service",
        sourceService: "time-guardian",
        createdAt: "2026-05-22T09:00:00.000Z",
        summary: "系统直接宣布卡片完成。",
      }),
    ).rejects.toMatchObject({ code: "INVALID_PROOF_EVENT" });
  });

  it("cannot complete a card that was not committed in the selected deck", async () => {
    const sink = { current: undefined as string | undefined };
    const harness = await createCommittedDeckHarness("plan-b", sink);
    tempDir = sink.current;

    await expect(
      harness.runtimeService.applyAction({
        requestId: "card_req_fake_unselected",
        deckId: harness.deck.deckId,
        cardId: "card_from_unselected_plan_a",
        action: "complete",
        clientContext: { now: "2026-05-22T09:10:00.000Z", timezone: "Asia/Shanghai" },
      }),
    ).rejects.toMatchObject({ code: "COMMITTED_CARD_NOT_FOUND" });
  });
});

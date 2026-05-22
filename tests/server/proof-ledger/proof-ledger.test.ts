import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonFileProofLedgerRepository } from "@/lib/server/proof-ledger/proof-ledger-repository";
import { ProofLedgerError } from "@/lib/server/proof-ledger/proof-event-validator";
import type { ProofEventRequest } from "@/lib/server/proof-ledger/types";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("ProofLedgerRepository", () => {
  it("appends proof events with stable ledger sequence", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-proof-ledger-"));
    const ledger = new JsonFileProofLedgerRepository(join(tempDir, "ledger.json"));

    const first = await ledger.appendEvent(deckCommittedRequest("proof_1", "deck_1"));
    const second = await ledger.appendEvent(deckCommittedRequest("proof_2", "deck_2"));
    const timeline = await ledger.getTimeline();

    expect(first.ledgerSequence).toBe(1);
    expect(second.ledgerSequence).toBe(2);
    expect(timeline.events.map((event) => event.id)).toEqual(["proof_1", "proof_2"]);
  });

  it("rejects shaming copy and fake completion claims", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-proof-ledger-"));
    const ledger = new JsonFileProofLedgerRepository(join(tempDir, "ledger.json"));

    await expect(
      ledger.appendEvent({
        ...deckCommittedRequest("proof_shame", "deck_1"),
        summary: "用户太懒，所以生成卡组。",
      }),
    ).rejects.toBeInstanceOf(ProofLedgerError);

    await expect(
      ledger.appendEvent({
        ...deckCommittedRequest("proof_fake_done", "deck_1"),
        metadata: { status: "completed" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_PROOF_EVENT" });
  });

  it("rejects card completion proof that does not come from Card Runtime", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-proof-ledger-"));
    const ledger = new JsonFileProofLedgerRepository(join(tempDir, "ledger.json"));

    await expect(
      ledger.appendEvent({
        id: "proof_fake_card_completed",
        type: "card_completed",
        deckId: "deck_1",
        cardId: "card_1",
        actor: "system-service",
        sourceService: "deck-commit",
        createdAt: "2026-05-22T09:00:00.000Z",
        summary: "系统声明卡片完成。",
      }),
    ).rejects.toMatchObject({ code: "INVALID_PROOF_EVENT" });
  });
});

function deckCommittedRequest(id: string, deckId: string): ProofEventRequest {
  return {
    id,
    type: "deck_committed",
    deckId,
    actor: "user",
    sourceService: "deck-commit",
    createdAt: "2026-05-22T09:00:00.000Z",
    summary: "用户选择一个 Plan Mode 方案并生成执行卡组。",
  };
}

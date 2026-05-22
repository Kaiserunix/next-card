import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DeckCommitService } from "@/lib/server/deck-commit/commit-service";
import { DeckCommitError } from "@/lib/server/deck-commit/commit-validator";
import { JsonFileDeckCommitRepository } from "@/lib/server/deck-commit/json-repositories";
import { JsonFilePlanModeDraftRepository } from "@/lib/server/plan-mode/plan-mode-repository";
import type { PlanModeDraft } from "@/lib/server/plan-mode/types";
import { JsonFileProofLedgerRepository } from "@/lib/server/proof-ledger/proof-ledger-repository";
import { JsonFileProofOutboxRepository, ProofOutboxService } from "@/lib/server/proof-ledger/proof-outbox-service";
import validProviderOutput from "@/tests/fixtures/plan-mode/provider-output-valid-abc.json";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("DeckCommitService", () => {
  it("commits only the user-selected Plan Mode option and writes proof through the outbox", async () => {
    const harness = await createHarness();
    await harness.planRepository.saveDraft(validProviderOutput.draft as PlanModeDraft);

    const response = await harness.service.commit({
      requestId: "commit_req_001",
      planModeDraftId: "draft_valid_abc",
      selectedOptionId: "plan-b",
      anonymousDeviceId: "anon-1",
      clientContext: { now: "2026-05-22T09:00:00.000Z", timezone: "Asia/Shanghai" },
    });

    expect(response.deck.selectedOptionId).toBe("plan-b");
    expect(response.cards).toHaveLength(3);
    expect(response.cards.every((card) => card.selectedOptionId === "plan-b")).toBe(true);
    expect(response.cards.map((card) => card.sourceCardDraftId)).toEqual(["card-b-1", "card-b-2", "card-b-3"]);
    expect(response.cards.some((card) => card.sourceCardDraftId.startsWith("card-a"))).toBe(false);
    expect(response.audit.writes).toMatchObject({
      deckCommitted: true,
      cardsCommitted: 3,
      proofOutboxQueued: true,
      proofAppended: true,
    });

    const storedCards = await harness.deckRepository.listCardsByDeck(response.deck.deckId);
    const timeline = await harness.ledger.getTimeline();
    expect(storedCards).toHaveLength(3);
    expect(timeline.events).toHaveLength(1);
    expect(timeline.events[0].type).toBe("deck_committed");
    expect(timeline.events[0].metadata?.selectedOptionId).toBe("plan-b");
  });

  it("rejects duplicate commits for the same Plan Mode draft", async () => {
    const harness = await createHarness();
    await harness.planRepository.saveDraft(validProviderOutput.draft as PlanModeDraft);
    const request = {
      requestId: "commit_req_002",
      planModeDraftId: "draft_valid_abc",
      selectedOptionId: "plan-a",
    };

    await harness.service.commit(request);
    await expect(harness.service.commit({ ...request, requestId: "commit_req_003" })).rejects.toMatchObject({
      code: "DUPLICATE_DECK_COMMIT",
    });
  });

  it("rejects non-ready Plan Mode drafts before creating a deck", async () => {
    const harness = await createHarness();
    await harness.planRepository.saveDraft({
      ...(validProviderOutput.draft as PlanModeDraft),
      id: "draft_needs_more_facts",
      status: "needs-more-facts",
    });

    await expect(
      harness.service.commit({
        requestId: "commit_req_004",
        planModeDraftId: "draft_needs_more_facts",
        selectedOptionId: "plan-a",
      }),
    ).rejects.toBeInstanceOf(DeckCommitError);
    expect(await harness.deckRepository.findDeckByPlanModeDraft("draft_needs_more_facts")).toBeNull();
  });
});

async function createHarness() {
  tempDir = await mkdtemp(join(tmpdir(), "nextcard-deck-commit-"));
  const planRepository = new JsonFilePlanModeDraftRepository(join(tempDir, "drafts.json"));
  const deckRepository = new JsonFileDeckCommitRepository({
    decksFile: join(tempDir, "decks.json"),
    cardsFile: join(tempDir, "cards.json"),
    auditFile: join(tempDir, "audit.json"),
  });
  const ledger = new JsonFileProofLedgerRepository(join(tempDir, "proof-ledger.json"));
  const proofOutbox = new ProofOutboxService(
    new JsonFileProofOutboxRepository(join(tempDir, "proof-outbox.json")),
    ledger,
    () => "2026-05-22T09:00:00.000Z",
  );
  const service = new DeckCommitService({
    planModeRepository: planRepository,
    deckRepository,
    proofOutboxService: proofOutbox,
    now: () => "2026-05-22T09:00:00.000Z",
  });

  return { service, planRepository, deckRepository, ledger };
}

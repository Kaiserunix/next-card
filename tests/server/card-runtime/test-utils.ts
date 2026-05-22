import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CardRuntimeService } from "@/lib/server/card-runtime/card-runtime-service";
import { JsonFileCardRuntimeRepository } from "@/lib/server/card-runtime/card-runtime-repository";
import { DeckCommitService } from "@/lib/server/deck-commit/commit-service";
import { JsonFileDeckCommitRepository } from "@/lib/server/deck-commit/json-repositories";
import { JsonFilePlanModeDraftRepository } from "@/lib/server/plan-mode/plan-mode-repository";
import type { PlanModeDraft } from "@/lib/server/plan-mode/types";
import { JsonFileProofLedgerRepository } from "@/lib/server/proof-ledger/proof-ledger-repository";
import { JsonFileProofOutboxRepository, ProofOutboxService } from "@/lib/server/proof-ledger/proof-outbox-service";
import validProviderOutput from "@/tests/fixtures/plan-mode/provider-output-valid-abc.json";

export async function createCommittedDeckHarness(
  selectedOptionId: "plan-a" | "plan-b" | "plan-c",
  tempDirSink?: { current?: string },
) {
  const tempDir = await mkdtemp(join(tmpdir(), "nextcard-card-runtime-"));
  if (tempDirSink) tempDirSink.current = tempDir;
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
  await planRepository.saveDraft(validProviderOutput.draft as PlanModeDraft);
  const commitService = new DeckCommitService({
    planModeRepository: planRepository,
    deckRepository,
    proofOutboxService: proofOutbox,
    now: () => "2026-05-22T09:00:00.000Z",
  });
  const commit = await commitService.commit({
    requestId: `commit_${selectedOptionId}`,
    planModeDraftId: "draft_valid_abc",
    selectedOptionId,
    anonymousDeviceId: "anon-runtime",
    clientContext: { now: "2026-05-22T09:00:00.000Z", timezone: "Asia/Shanghai" },
  });
  const runtimeService = new CardRuntimeService({
    deckRepository,
    runtimeRepository: new JsonFileCardRuntimeRepository(join(tempDir, "card-runtime.json")),
    proofLedgerRepository: ledger,
    proofOutboxService: proofOutbox,
    now: () => "2026-05-22T09:01:00.000Z",
  });

  return { runtimeService, deckRepository, ledger, deck: commit.deck, cards: commit.cards, tempDir };
}

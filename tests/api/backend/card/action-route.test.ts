import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/card/action/route";
import { DeckCommitService } from "@/lib/server/deck-commit/commit-service";
import { JsonFileDeckCommitRepository } from "@/lib/server/deck-commit/json-repositories";
import { JsonFilePlanModeDraftRepository } from "@/lib/server/plan-mode/plan-mode-repository";
import type { PlanModeDraft } from "@/lib/server/plan-mode/types";
import validProviderOutput from "@/tests/fixtures/plan-mode/provider-output-valid-abc.json";

let tempDir: string | undefined;
const originalEnv = {
  NEXTCARD_PLAN_MODE_DRAFT_FILE: process.env.NEXTCARD_PLAN_MODE_DRAFT_FILE,
  NEXTCARD_DECKS_FILE: process.env.NEXTCARD_DECKS_FILE,
  NEXTCARD_CARDS_FILE: process.env.NEXTCARD_CARDS_FILE,
  NEXTCARD_DECK_COMMIT_AUDIT_FILE: process.env.NEXTCARD_DECK_COMMIT_AUDIT_FILE,
  NEXTCARD_PROOF_LEDGER_FILE: process.env.NEXTCARD_PROOF_LEDGER_FILE,
  NEXTCARD_PROOF_OUTBOX_FILE: process.env.NEXTCARD_PROOF_OUTBOX_FILE,
  NEXTCARD_CARD_RUNTIME_FILE: process.env.NEXTCARD_CARD_RUNTIME_FILE,
};

afterEach(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key as keyof typeof originalEnv];
    } else {
      process.env[key as keyof typeof originalEnv] = value;
    }
  }
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("POST /api/backend/card/action", () => {
  it("runs a card completion action through the runtime route", async () => {
    const commit = await seedCommittedDeck();
    const card = commit.cards[0];

    const response = await POST(
      new Request("http://localhost/api/backend/card/action", {
        method: "POST",
        body: JSON.stringify({
          requestId: "route_card_complete_1",
          deckId: commit.deck.deckId,
          cardId: card.cardId,
          action: "complete",
          actualMinutes: 4,
          clientContext: { now: "2026-05-22T09:12:00.000Z", timezone: "Asia/Shanghai" },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cardRuntimeState.status).toBe("completed");
    expect(body.proofEvents[0]).toMatchObject({ type: "card_completed", sourceService: "card-runtime" });
    expect(JSON.stringify(body)).not.toMatch(/committedDeck|profileSnapshot/);
  });
});

async function seedCommittedDeck() {
  tempDir = await mkdtemp(join(tmpdir(), "nextcard-card-route-"));
  process.env.NEXTCARD_PLAN_MODE_DRAFT_FILE = join(tempDir, "drafts.json");
  process.env.NEXTCARD_DECKS_FILE = join(tempDir, "decks.json");
  process.env.NEXTCARD_CARDS_FILE = join(tempDir, "cards.json");
  process.env.NEXTCARD_DECK_COMMIT_AUDIT_FILE = join(tempDir, "audit.json");
  process.env.NEXTCARD_PROOF_LEDGER_FILE = join(tempDir, "proof-ledger.json");
  process.env.NEXTCARD_PROOF_OUTBOX_FILE = join(tempDir, "proof-outbox.json");
  process.env.NEXTCARD_CARD_RUNTIME_FILE = join(tempDir, "card-runtime.json");

  const planRepository = new JsonFilePlanModeDraftRepository();
  await planRepository.saveDraft(validProviderOutput.draft as PlanModeDraft);
  const service = new DeckCommitService({
    planModeRepository: planRepository,
    deckRepository: new JsonFileDeckCommitRepository(),
  });
  return service.commit({
    requestId: "route_commit_card_runtime",
    planModeDraftId: "draft_valid_abc",
    selectedOptionId: "plan-b",
    clientContext: { now: "2026-05-22T09:00:00.000Z", timezone: "Asia/Shanghai" },
  });
}

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST as CARD_POST } from "@/app/api/backend/card/action/route";
import { GET, POST } from "@/app/api/backend/proof/timeline/route";
import { DeckCommitService } from "@/lib/server/deck-commit/commit-service";
import { JsonFilePlanModeDraftRepository } from "@/lib/server/plan-mode/plan-mode-repository";
import type { PlanModeDraft } from "@/lib/server/plan-mode/types";
import { JsonFileProofLedgerRepository } from "@/lib/server/proof-ledger/proof-ledger-repository";
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

describe("GET /api/backend/proof/timeline", () => {
  it("reads projected proof timeline entries for a deck", async () => {
    const commit = await seedCommittedDeck();
    const card = commit.cards[0];
    await CARD_POST(
      new Request("http://localhost/api/backend/card/action", {
        method: "POST",
        body: JSON.stringify({
          requestId: "timeline_route_complete_1",
          deckId: commit.deck.deckId,
          cardId: card.cardId,
          action: "complete",
          actualMinutes: 4,
          clientContext: { now: "2026-05-22T09:12:00.000Z", timezone: "Asia/Shanghai" },
        }),
      }),
    );

    const response = await GET(new Request(`http://localhost/api/backend/proof/timeline?deckId=${commit.deck.deckId}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries.map((entry: { type: string }) => entry.type)).toEqual(["deck_committed", "card_completed"]);
    expect(body.summary.completedCards).toBe(1);
    expect(body.boundaryWarnings).toContain("proof-timeline-readonly: this projection does not append or mutate proof");
  });

  it("does not accept proof append payloads", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(body.error).toBe("PROOF_TIMELINE_READONLY");
  });

  it("returns recorded reminders without claiming delivery", async () => {
    const commit = await seedCommittedDeck();
    const ledger = new JsonFileProofLedgerRepository(process.env.NEXTCARD_PROOF_LEDGER_FILE);
    await ledger.appendEvent({
      id: "timeline_route_reminder_created_1",
      type: "reminder_created",
      deckId: commit.deck.deckId,
      actor: "system-service",
      sourceService: "time-guardian",
      createdAt: "2026-05-22T09:20:00.000Z",
      summary: "已记录课前 30 分钟提醒。",
    });

    const response = await GET(new Request(`http://localhost/api/backend/proof/timeline?deckId=${commit.deck.deckId}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries.at(-1)).toMatchObject({
      type: "reminder_created",
      title: "提醒已记录",
    });
    expect(body.entries.map((entry: { type: string }) => entry.type)).not.toContain("reminder_delivered");
  });
});

async function seedCommittedDeck() {
  tempDir = await mkdtemp(join(tmpdir(), "nextcard-proof-timeline-route-"));
  process.env.NEXTCARD_PLAN_MODE_DRAFT_FILE = join(tempDir, "drafts.json");
  process.env.NEXTCARD_DECKS_FILE = join(tempDir, "decks.json");
  process.env.NEXTCARD_CARDS_FILE = join(tempDir, "cards.json");
  process.env.NEXTCARD_DECK_COMMIT_AUDIT_FILE = join(tempDir, "audit.json");
  process.env.NEXTCARD_PROOF_LEDGER_FILE = join(tempDir, "proof-ledger.json");
  process.env.NEXTCARD_PROOF_OUTBOX_FILE = join(tempDir, "proof-outbox.json");
  process.env.NEXTCARD_CARD_RUNTIME_FILE = join(tempDir, "card-runtime.json");

  const planRepository = new JsonFilePlanModeDraftRepository();
  await planRepository.saveDraft(validProviderOutput.draft as PlanModeDraft);
  const service = new DeckCommitService({ planModeRepository: planRepository });
  return service.commit({
    requestId: "route_commit_proof_timeline",
    planModeDraftId: "draft_valid_abc",
    selectedOptionId: "plan-b",
    clientContext: { now: "2026-05-22T09:00:00.000Z", timezone: "Asia/Shanghai" },
  });
}

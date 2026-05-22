import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/deck/commit/route";
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
};

afterEach(async () => {
  restoreEnv();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("POST /api/backend/deck/commit", () => {
  it("commits a selected option without leaking tokens or committing unselected cards", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-deck-commit-route-"));
    configureEnv(tempDir);
    await new JsonFilePlanModeDraftRepository(process.env.NEXTCARD_PLAN_MODE_DRAFT_FILE!).saveDraft(
      validProviderOutput.draft as PlanModeDraft,
    );
    process.env.MIMO_API_KEY = "tp-test-secret";

    const response = await POST(
      jsonRequest({
        requestId: "commit_route_req_001",
        planModeDraftId: "draft_valid_abc",
        selectedOptionId: "plan-c",
        clientContext: { now: "2026-05-22T10:00:00.000Z", timezone: "Asia/Shanghai" },
      }),
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(serialized).not.toContain("tp-test-secret");
    expect(body.deck.selectedOptionId).toBe("plan-c");
    expect(body.cards).toHaveLength(3);
    expect(body.cards.every((card: { selectedOptionId: string }) => card.selectedOptionId === "plan-c")).toBe(true);
    expect(body.cards.some((card: { sourceCardDraftId: string }) => card.sourceCardDraftId.startsWith("card-a"))).toBe(false);
    expect(body.proofEvents[0].type).toBe("deck_committed");
  });

  it("rejects an invalid selected option", async () => {
    const response = await POST(
      jsonRequest({
        requestId: "commit_route_req_002",
        planModeDraftId: "draft_valid_abc",
        selectedOptionId: "plan-x",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("INVALID_DECK_COMMIT_REQUEST");
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/backend/deck/commit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function configureEnv(dir: string): void {
  process.env.NEXTCARD_PLAN_MODE_DRAFT_FILE = join(dir, "drafts.json");
  process.env.NEXTCARD_DECKS_FILE = join(dir, "decks.json");
  process.env.NEXTCARD_CARDS_FILE = join(dir, "cards.json");
  process.env.NEXTCARD_DECK_COMMIT_AUDIT_FILE = join(dir, "audit.json");
  process.env.NEXTCARD_PROOF_LEDGER_FILE = join(dir, "proof-ledger.json");
  process.env.NEXTCARD_PROOF_OUTBOX_FILE = join(dir, "proof-outbox.json");
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

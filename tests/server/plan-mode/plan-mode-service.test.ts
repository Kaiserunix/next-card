import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDefaultPlanModeProvider, PlanModeService } from "@/lib/server/plan-mode/plan-mode-service";
import { JsonFilePlanModeDraftRepository } from "@/lib/server/plan-mode/plan-mode-repository";
import type { PlanModeProviderInput, PlanModeProviderOutput, PlanModeProviderPort } from "@/lib/server/plan-mode/types";
import voiceConfirmed from "@/tests/fixtures/plan-mode/voice-confirmed-calculus-handoff.json";
import broadCardProviderOutput from "@/tests/fixtures/plan-mode/provider-output-broad-card.json";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("PlanModeService", () => {
  it("selects Mimo as the default runtime provider outside tests when configured", () => {
    const provider = createDefaultPlanModeProvider({
      env: {
        NODE_ENV: "development",
        MIMO_API_KEY: "tp-test-secret",
        MIMO_BASE_URL: "https://token-plan-cn.xiaomimimo.com/v1",
        MIMO_PLANNER_MODEL: "mimo-v2.5-pro",
      },
    });

    expect(provider.provider).toBe("mimo");
  });

  it("keeps deterministic-local as the default test provider unless Mimo is explicitly requested", () => {
    const implicitProvider = createDefaultPlanModeProvider({
      env: {
        NODE_ENV: "test",
        MIMO_API_KEY: "tp-test-secret",
      },
    });
    const explicitProvider = createDefaultPlanModeProvider({
      env: {
        NODE_ENV: "test",
        NEXTCARD_PLAN_MODE_PROVIDER: "mimo",
        MIMO_API_KEY: "tp-test-secret",
      },
    });

    expect(implicitProvider.provider).toBe("deterministic-local");
    expect(explicitProvider.provider).toBe("mimo");
  });

  it("creates, validates, and saves a deterministic draft", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-plan-mode-service-"));
    const repository = new JsonFilePlanModeDraftRepository(join(tempDir, "drafts.json"));
    const service = new PlanModeService({ repository, now: () => "2026-05-21T12:00:00.000Z" });

    const response = await service.createDraft(voiceConfirmed);
    const saved = await repository.getDraft(response.draft.id);

    expect(response.draft.status).toBe("options-ready");
    expect(response.draft.options.map((option) => option.mode)).toEqual(["A", "B", "C"]);
    expect(response.draft.writes).toEqual({
      deckCommitted: false,
      proofWritten: false,
      remindersCreated: false,
      scheduleQueued: false,
    });
    expect(saved?.id).toBe(response.draft.id);
  });

  it("falls back to deterministic-local when a configured provider returns invalid output", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-plan-mode-service-"));
    const invalidProvider: PlanModeProviderPort = {
      provider: "mimo",
      async generatePlanModeDraft(_input: PlanModeProviderInput): Promise<PlanModeProviderOutput> {
        return broadCardProviderOutput as unknown as PlanModeProviderOutput;
      },
    };
    const service = new PlanModeService({
      provider: invalidProvider,
      repository: new JsonFilePlanModeDraftRepository(join(tempDir, "drafts.json")),
      now: () => "2026-05-21T12:00:00.000Z",
    });

    const response = await service.createDraft(voiceConfirmed);

    expect(response.draft.provider).toBe("deterministic-local");
    expect(response.draft.options).toHaveLength(3);
  });
});

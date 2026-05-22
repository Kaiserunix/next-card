import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PlanModeService } from "@/lib/server/plan-mode/plan-mode-service";
import { JsonFilePlanModeDraftRepository } from "@/lib/server/plan-mode/plan-mode-repository";
import type { PlanModeRequest } from "@/lib/server/plan-mode/types";
import voiceConfirmed from "@/tests/fixtures/plan-mode/voice-confirmed-calculus-handoff.json";
import regenerateRequest from "@/tests/fixtures/plan-mode/regenerate-from-previous-draft.json";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("plan mode regeneration", () => {
  it("creates a new draft linked to the previous draft without mutating it", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-plan-mode-regen-"));
    const repository = new JsonFilePlanModeDraftRepository(join(tempDir, "drafts.json"));
    const service = new PlanModeService({ repository, now: () => "2026-05-21T12:00:00.000Z" });

    const first = await service.createDraft(voiceConfirmed);
    const regenerate = structuredClone(regenerateRequest) as PlanModeRequest;
    regenerate.previousPlanModeDraftId = first.draft.id;

    const second = await service.createDraft(regenerate);

    expect(second.draft.id).not.toBe(first.draft.id);
    expect(second.draft.previousPlanModeDraftId).toBe(first.draft.id);
    expect(second.draft.planCompilerHandoffId).toBe(first.draft.planCompilerHandoffId);
    expect((await repository.getDraft(first.draft.id))?.previousPlanModeDraftId).toBeUndefined();
    expect(await repository.listDraftsByHandoff(first.draft.verifiedInputBundleId)).toHaveLength(2);
  });
});

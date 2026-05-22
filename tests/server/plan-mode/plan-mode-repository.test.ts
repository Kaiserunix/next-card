import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonFilePlanModeDraftRepository } from "@/lib/server/plan-mode/plan-mode-repository";
import type { PlanModeProviderOutput } from "@/lib/server/plan-mode/types";
import providerOutput from "@/tests/fixtures/plan-mode/provider-output-valid-abc.json";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("JsonFilePlanModeDraftRepository", () => {
  it("saves, reads, and upserts plan mode drafts", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-plan-mode-"));
    const repo = new JsonFilePlanModeDraftRepository(join(tempDir, "drafts.json"));
    const draft = (providerOutput as unknown as PlanModeProviderOutput).draft;

    await repo.saveDraft(draft);
    await repo.saveDraft({ ...draft, goalUnderstanding: "updated understanding" });

    const saved = await repo.getDraft(draft.id);
    const listed = await repo.listDraftsByHandoff(draft.verifiedInputBundleId);

    expect(saved?.goalUnderstanding).toBe("updated understanding");
    expect(listed).toHaveLength(1);
    expect(await repo.getDraft("missing")).toBeNull();
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BackendSandboxRunService } from "@/lib/server/backend-orchestrator/sandbox-run-service";
import { MockMultimodalExtractor } from "@/lib/server/input-layer/mock-multimodal-extractor";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("BackendSandboxRunService", () => {
  it("runs a text happy path into Plan Mode, selected deck commit, Time Guardian, and proof timeline", async () => {
    const service = await createService();

    const report = await service.run({
      sourceType: "text",
      text: "写英语作文",
      selectedOptionId: "plan-b",
      clientContext: {
        now: "2026-05-22T09:00:00.000Z",
        timezone: "Asia/Shanghai",
        anonymousDeviceId: "anon-sandbox",
      },
    });

    expect(report.sandbox).toBe(true);
    expect(report.importReview.canProceedToPlanMode).toBe(true);
    expect(report.planModeDraft?.options.map((option) => option.mode)).toEqual(["A", "B", "C"]);
    expect(report.committedDeck?.selectedOptionId).toBe("plan-b");
    expect(report.committedCards).toHaveLength(3);
    expect(report.committedCards?.every((card) => card.selectedOptionId === "plan-b")).toBe(true);
    expect(report.timeGuardianActions.length).toBeGreaterThan(0);
    expect(report.timeGuardianActions.every((action) => action.chosenPlanId === "plan-b")).toBe(true);
    expect(report.proofTimeline.map((event) => event.type)).toEqual(["deck_committed"]);
    expect(report.errors).toEqual([]);
  });

  it("stops image strict review before Plan Mode or deck commit", async () => {
    const service = await createService();

    const report = await service.run({
      sourceType: "image",
      text: "课表：周一 8:00 高数",
      selectedOptionId: "plan-b",
      clientContext: {
        now: "2026-05-22T09:00:00.000Z",
        timezone: "Asia/Shanghai",
      },
    });

    expect(report.importReview.reviewGate.requirement).toBe("strict");
    expect(report.planModeDraft).toBeUndefined();
    expect(report.committedDeck).toBeUndefined();
    expect(report.proofTimeline).toEqual([]);
    expect(report.errors[0]).toMatchObject({ stage: "import-review", recoverable: true });
  });

  it("requires explicit selected option and never defaults to option A", async () => {
    const service = await createService();

    const report = await service.run({
      sourceType: "text",
      text: "写英语作文",
      clientContext: {
        now: "2026-05-22T09:00:00.000Z",
        timezone: "Asia/Shanghai",
      },
    });

    expect(report.importReview.canProceedToPlanMode).toBe(true);
    expect(report.planModeDraft).toBeUndefined();
    expect(report.committedDeck).toBeUndefined();
    expect(report.errors[0]).toMatchObject({ stage: "deck-commit" });
  });

  it("schedules only the selected option", async () => {
    const service = await createService();

    const report = await service.run({
      sourceType: "text",
      text: "写英语作文",
      selectedOptionId: "plan-c",
      clientContext: {
        now: "2026-05-22T09:00:00.000Z",
        timezone: "Asia/Shanghai",
      },
    });

    expect(report.committedCards?.every((card) => card.selectedOptionId === "plan-c")).toBe(true);
    expect(report.timeGuardianActions.every((action) => action.chosenPlanId === "plan-c")).toBe(true);
    expect(report.timeGuardianActions.some((action) => action.chosenPlanId === "plan-a")).toBe(false);
    expect(report.timeGuardianActions.some((action) => action.chosenPlanId === "plan-b")).toBe(false);
  });
});

async function createService(): Promise<BackendSandboxRunService> {
  tempDir = await mkdtemp(join(tmpdir(), "nextcard-sandbox-run-"));
  return new BackendSandboxRunService({
    sandboxRootDir: tempDir,
    multimodalExtractor: new MockMultimodalExtractor(),
    now: () => "2026-05-22T09:00:00.000Z",
  });
}

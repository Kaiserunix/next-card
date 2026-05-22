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

describe("BackendSandboxRunService timeline inputs", () => {
  it("runs card actions and projects card_completed into the proof timeline", async () => {
    const service = await createService();
    const report = await service.run({
      sourceType: "text",
      text: "写英语作文",
      selectedOptionId: "plan-b",
      cardActions: [{ action: "complete", actualMinutes: 6 }],
      clientContext: context(),
    });

    expect(report.committedDeck?.selectedOptionId).toBe("plan-b");
    expect(report.cardRuntimeActions).toHaveLength(1);
    expect(report.proofTimeline.map((entry) => entry.type)).toEqual(["deck_committed", "card_completed"]);
  });

  it("keeps strict image review stopped until confirmation, then continues", async () => {
    const service = await createService();
    const stopped = await service.run({
      sourceType: "image",
      text: "课表：周一 8:00 高数",
      selectedOptionId: "plan-b",
      clientContext: context(),
    });
    expect(stopped.importReview.reviewGate.requirement).toBe("strict");
    expect(stopped.planModeDraft).toBeUndefined();

    const confirmed = await service.run({
      sourceType: "image",
      text: "课表：周一 8:00 高数",
      selectedOptionId: "plan-b",
      confirmation: { action: "confirm" },
      cardActions: [{ action: "complete", actualMinutes: 5 }],
      clientContext: context(),
    });

    expect(confirmed.importConfirmation?.status).toBe("confirmed");
    expect(confirmed.planModeDraft?.options.map((option) => option.id)).toEqual(["plan-a", "plan-b", "plan-c"]);
    expect(confirmed.committedDeck?.selectedOptionId).toBe("plan-b");
    expect(confirmed.proofTimeline.map((entry) => entry.type)).toContain("card_completed");
  });

  it("preserves crowded timeline inputs and schedules only selected plan B", async () => {
    const service = await createService();
    const report = await service.run({
      sourceType: "text",
      text: "写英语作文",
      selectedOptionId: "plan-b",
      availableWindows: [
        window("window_after_class", "2026-05-22T11:30:00.000Z", "2026-05-22T12:30:00.000Z"),
      ],
      timeLocks: [
        {
          id: "lock_class",
          userId: "anon-sandbox",
          kind: "class_time",
          startAt: "2026-05-22T09:45:00.000Z",
          endAt: "2026-05-22T11:15:00.000Z",
          timezone: "Asia/Shanghai",
          movable: false,
          sourceRefs: [{ rawInputId: "raw_1", quote: "固定上课", confidence: 1 }],
          reviewStatus: "user-confirmed",
          conflictStatus: "none",
        },
      ],
      cardActions: [
        {
          action: "defer",
          deferToWindow: window("window_after_class", "2026-05-22T11:30:00.000Z", "2026-05-22T12:00:00.000Z"),
        },
      ],
      clientContext: context(),
    });

    expect(report.timeGuardianActions.every((action) => !("chosenPlanId" in action) || action.chosenPlanId === "plan-b")).toBe(true);
    expect(report.timeGuardianActions.some((action) => action.type === "defer-card")).toBe(true);
    expect(JSON.stringify(report.timeGuardianActions)).not.toContain("plan-a");
    expect(JSON.stringify(report.timeGuardianActions)).not.toContain("plan-c");
  });
});

async function createService(): Promise<BackendSandboxRunService> {
  tempDir = await mkdtemp(join(tmpdir(), "nextcard-sandbox-timeline-"));
  return new BackendSandboxRunService({
    sandboxRootDir: tempDir,
    multimodalExtractor: new MockMultimodalExtractor(),
    now: () => "2026-05-22T09:00:00.000Z",
  });
}

function context() {
  return {
    now: "2026-05-22T09:00:00.000Z",
    timezone: "Asia/Shanghai",
    locale: "zh-CN" as const,
    anonymousDeviceId: "anon-sandbox",
  };
}

function window(id: string, startAt: string, endAt: string) {
  return {
    id,
    startAt,
    endAt,
    timezone: "Asia/Shanghai",
    source: "user-stated" as const,
    confidence: 1,
  };
}

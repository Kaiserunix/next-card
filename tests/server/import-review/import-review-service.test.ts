import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ImportReviewService } from "@/lib/server/import-review/import-review-service";
import { MockMultimodalExtractor } from "@/lib/server/input-layer/mock-multimodal-extractor";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("ImportReviewService", () => {
  it("reviews lightweight text input without committing deck or proof state", async () => {
    const service = new ImportReviewService();
    const report = await service.review({
      sourceType: "text",
      text: "整理英语作文提纲",
      clientContext: { now: "2026-05-22T08:00:00.000Z", timezone: "Asia/Shanghai", locale: "zh-CN" },
      sandboxMode: true,
    });

    expect(report.sourceType).toBe("text");
    expect(report.reviewGate.requirement).toBe("light");
    expect(report.canProceedToPlanMode).toBe(false);
    expect(report.planCompilerHandoff).toBeUndefined();
    expect(JSON.stringify(report)).not.toMatch(/committedDeck|proofRecord|reminderJob|profileSnapshot/);
  });

  it("can produce a PlanCompilerHandoff only after explicit confirmation of sufficient facts", async () => {
    const service = new ImportReviewService();
    const report = await service.review({
      sourceType: "text",
      text: "整理英语作文提纲",
      clientContext: { now: "2026-05-22T08:00:00.000Z", timezone: "Asia/Shanghai", locale: "zh-CN" },
      sandboxMode: true,
      confirmationAction: "confirm",
    });

    expect(report.canProceedToPlanMode).toBe(true);
    expect(report.planCompilerHandoff).toMatchObject({
      sourceType: "text",
      mustGenerateABC: true,
    });
  });

  it("reviews image input through a multimodal extractor and keeps it in strict review", async () => {
    const dir = await tempDir();
    const imagePath = join(dir, "schedule.jpg");
    await writeFile(imagePath, Buffer.from("fake image"));
    const service = new ImportReviewService({
      multimodalExtractor: new MockMultimodalExtractor(),
    });

    const report = await service.review({
      sourceType: "image",
      filePath: imagePath,
      text: "周一 8:00 高数",
      clientContext: { now: "2026-05-22T08:00:00.000Z", timezone: "Asia/Shanghai", locale: "zh-CN" },
      sandboxMode: true,
    });

    expect(report.providerUsage).toMatchObject({ provider: "mock", used: true });
    expect(report.reviewGate.requirement).toBe("strict");
    expect(report.extraction.warnings).toEqual(expect.arrayContaining(["high_risk_multimodal", "course_time"]));
    expect(report.canProceedToPlanMode).toBe(false);
  });
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "nextcard-import-service-"));
  tempDirs.push(dir);
  return dir;
}

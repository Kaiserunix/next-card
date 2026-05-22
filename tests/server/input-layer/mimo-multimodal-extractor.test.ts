import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MimoMultimodalExtractor } from "@/lib/server/input-layer/mimo-multimodal-extractor";
import type { RawInput } from "@/lib/server/input-layer/types";
import type { MimoChatCompletionClient, MimoChatCompletionRequest } from "@/lib/server/mimo-openai-client";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("MimoMultimodalExtractor", () => {
  it("returns strict-review extraction for a MiMo-recognized timetable image", async () => {
    const dir = await tempDir();
    const imagePath = join(dir, "schedule.jpg");
    await writeFile(imagePath, Buffer.from(SMALL_JPG_BASE64, "base64"));
    const requests: MimoChatCompletionRequest[] = [];
    const client = mockClient(async (request) => {
      requests.push(request);
      return JSON.stringify({
        sourceKind: "courseSchedule",
        extractedEvents: [{ title: "高数", day: "周一", time: "08:00-09:30", location: "三教201" }],
        extractedTimes: [{ label: "周一 08:00-09:30", kind: "hard-lock" }],
        extractedLocations: [{ name: "三教201" }],
        warnings: [],
        needsStrictReview: true,
      });
    });

    const extractor = new MimoMultimodalExtractor({
      client,
      imageOutputDir: join(dir, "prepared"),
      preprocessOptions: { maxSide: 1280, jpegQuality: 76, maxOriginalBytes: 100_000 },
    });
    const result = await extractor.extract(rawInput(imagePath));

    expect(requests[0]?.model).toBe("mimo-v2.5");
    expect(JSON.stringify(requests[0]?.messages)).toContain("image_url");
    expect(result.reviewRequirement).toBe("strict");
    expect(result.warnings).toEqual(expect.arrayContaining(["high_risk_multimodal", "course_time"]));
    expect(result.candidates.courses[0]).toMatchObject({ courseName: "高数" });
    expect(result.candidates.timeConstraints[0]).toMatchObject({ kind: "hard-lock", isHard: true });
  });

  it("returns a recoverable blocked extraction when the MiMo client fails", async () => {
    const dir = await tempDir();
    const imagePath = join(dir, "schedule.jpg");
    await writeFile(imagePath, Buffer.from(SMALL_JPG_BASE64, "base64"));
    const extractor = new MimoMultimodalExtractor({
      client: mockClient(async () => {
        throw new Error("MiMo request timed out after 1000ms.");
      }),
      imageOutputDir: join(dir, "prepared"),
      preprocessOptions: { maxSide: 1280, jpegQuality: 76, maxOriginalBytes: 100_000 },
    });

    const result = await extractor.extract(rawInput(imagePath));

    expect(result.reviewRequirement).toBe("blocked");
    expect(result.candidates.tasks).toHaveLength(0);
    expect(result.warnings).toEqual(expect.arrayContaining(["high_risk_multimodal", "insufficient_input"]));
    expect(result.ambiguities.join(" ")).toContain("MiMo");
  });
});

function mockClient(handler: (request: MimoChatCompletionRequest) => Promise<string>): MimoChatCompletionClient {
  return {
    getPublicConfig: () => ({
      configured: true,
      baseUrl: "http://127.0.0.1/v1",
      anthropicBaseUrl: "http://127.0.0.1/anthropic",
      plannerModel: "mimo-v2.5-pro",
      multimodalModel: "mimo-v2.5",
    }),
    createChatCompletion: vi.fn(handler),
  };
}

function rawInput(contentRef: string): RawInput {
  return {
    id: "raw_image_1",
    sourceType: "image",
    contentRef,
    sourceHash: "b".repeat(64),
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    createdAt: "2026-05-22T08:00:00.000Z",
    receivedAt: "2026-05-22T08:00:00.000Z",
    privacyFlags: ["unknown"],
    retentionPolicy: {
      rawRetentionDays: 14,
      derivedRetentionDays: 30,
      userDeletable: true,
    },
  };
}

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "nextcard-mimo-extractor-"));
  tempDirs.push(dir);
  return dir;
}

const SMALL_JPG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/ISf/2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQIBAT8QH//EFBQBAQAAAAAAAAAAAAAAAAAAARD/2gAIAQEAAT8QH//Z";

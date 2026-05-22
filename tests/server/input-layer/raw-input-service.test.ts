import { describe, expect, it } from "vitest";
import { InMemoryRawInputRepository } from "@/lib/server/input-layer/raw-input-repository";
import { createRawInput, isVoiceLikeRawInput } from "@/lib/server/input-layer/raw-input-service";

describe("createRawInput", () => {
  it("stores a text RawInput without creating downstream authoritative state", async () => {
    const repository = new InMemoryRawInputRepository();
    const result = await createRawInput(
      {
        sourceType: "text",
        text: "明天早八去高数课",
        anonymousDeviceId: "device-a",
        receivedAt: "2026-05-21T08:00:00.000Z",
      },
      repository,
    );

    expect(result.acceptedForExtraction).toBe(true);
    expect(result.rawInput.sourceType).toBe("text");
    expect(result.rawInput.text).toBe("明天早八去高数课");
    expect(result.rawInput.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.rawInput.retentionPolicy.userDeletable).toBe(true);
    expect(result).not.toHaveProperty("deck");
    expect(result).not.toHaveProperty("proof");
    expect(result).not.toHaveProperty("reminder");
  });

  it("marks manual dictation as voice-like without implying ASR quota usage", async () => {
    const repository = new InMemoryRawInputRepository();
    const result = await createRawInput(
      {
        sourceType: "manual-dictation",
        text: "今晚八点前交英语作文",
        anonymousDeviceId: "device-a",
      },
      repository,
    );

    expect(isVoiceLikeRawInput(result.rawInput)).toBe(true);
    expect(result.rawInput.sourceType).toBe("manual-dictation");
  });

  it("deduplicates the same source hash for the same anonymous device on the same day", async () => {
    const repository = new InMemoryRawInputRepository();
    const command = {
      sourceType: "notification" as const,
      text: "课程群通知：明天 20:00 前交实验报告",
      anonymousDeviceId: "device-a",
      receivedAt: "2026-05-21T08:00:00.000Z",
    };

    const first = await createRawInput(command, repository);
    const second = await createRawInput(command, repository);

    expect(first.acceptedForExtraction).toBe(true);
    expect(second.acceptedForExtraction).toBe(false);
    expect(second.duplicateOf).toBe(first.rawInput.id);
    expect(second.rawInput.id).toBe(first.rawInput.id);
  });

  it("keeps file-like input even when parsed text is absent", async () => {
    const repository = new InMemoryRawInputRepository();
    const result = await createRawInput(
      {
        sourceType: "pdf",
        contentRef: "upload://requirements.pdf",
        anonymousDeviceId: "device-a",
        timezone: "Asia/Shanghai",
      },
      repository,
    );

    expect(result.rawInput.contentRef).toBe("upload://requirements.pdf");
    expect(result.rawInput.privacyFlags).toContain("unknown");
    expect(result.acceptedForExtraction).toBe(true);
  });

  it("flags student ids, third-party info, and locations conservatively", async () => {
    const repository = new InMemoryRawInputRepository();
    const result = await createRawInput(
      {
        sourceType: "text",
        text: "张老师说 2026123456 班同学明天到一教 302 交成绩单",
        anonymousDeviceId: "device-a",
      },
      repository,
    );

    expect(result.rawInput.privacyFlags).toEqual(
      expect.arrayContaining(["contains_third_party_info", "contains_student_id", "contains_location", "contains_grade_info"]),
    );
  });
});

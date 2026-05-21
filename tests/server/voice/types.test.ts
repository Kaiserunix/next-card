import { describe, expect, it } from "vitest";
import type { SpeechTranscript, VoiceUsageLimit } from "@/lib/server/voice/types";

describe("voice type contracts", () => {
  it("keeps manual dictation separate from paid ASR providers", () => {
    const transcript: SpeechTranscript = {
      id: "tr_1",
      text: "明天早八高数课提醒我出门",
      rawTranscript: "明天早八高数课提醒我出门",
      normalizedText: "明天早八高数课提醒我出门。",
      source: "manual-dictation",
      provider: "manual",
      language: "zh-CN",
      confidence: 1,
      userConfirmed: true,
      createdAt: "2026-05-21T00:00:00.000Z",
    };

    expect(transcript.source).toBe("manual-dictation");
    expect(transcript.provider).toBe("manual");
  });

  it("expresses the experience quota defaults", () => {
    const limit: VoiceUsageLimit = {
      maxDurationMsPerClip: 30_000,
      maxClipsPerDay: 30,
      maxTotalDurationMsPerDay: 600_000,
      provider: "volcengine",
    };

    expect(limit.maxClipsPerDay).toBe(30);
  });
});

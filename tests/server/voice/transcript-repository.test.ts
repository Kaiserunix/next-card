import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { LocalJsonVoiceTranscriptRepository } from "@/lib/server/voice/transcript-repository";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("LocalJsonVoiceTranscriptRepository", () => {
  it("stores only confirmed transcript records", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-transcript-"));
    const repo = new LocalJsonVoiceTranscriptRepository(join(tempDir, "voice-transcripts.json"));

    await repo.append({
      anonymousDeviceId: "device_a",
      confirmedAt: "2026-05-21T01:02:00.000Z",
      transcript: {
        id: "tr_1",
        text: "明天早八高数课提醒我出门。",
        rawTranscript: "明天早八高数课提醒我出门",
        normalizedText: "明天早八高数课提醒我出门。",
        source: "volcengine-asr",
        provider: "volcengine",
        language: "zh-CN",
        durationMs: 20_000,
        confidence: 0.82,
        userConfirmed: true,
        createdAt: "2026-05-21T01:00:00.000Z",
      },
    });

    const records = await repo.listForDevice("device_a");

    expect(records).toHaveLength(1);
    expect(records[0].transcript.userConfirmed).toBe(true);
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/voice/confirm/route";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
  delete process.env.NEXTCARD_VOICE_TRANSCRIPT_FILE;
});

describe("POST /api/backend/voice/confirm", () => {
  it("stores confirmed transcript metadata only", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-confirm-"));
    process.env.NEXTCARD_VOICE_TRANSCRIPT_FILE = join(tempDir, "voice-transcripts.json");

    const response = await POST(
      new Request("http://localhost/api/backend/voice/confirm", {
        method: "POST",
        body: JSON.stringify({
          anonymousDeviceId: "device_a",
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
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.saved).toBe(true);
  });
});

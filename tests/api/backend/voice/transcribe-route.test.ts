import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/backend/voice/transcribe/route";

let tempDir: string | undefined;
const originalApiKey = process.env.VOLCENGINE_ASR_API_KEY;
const originalUsageFile = process.env.NEXTCARD_VOICE_USAGE_FILE;
const originalMaxAudioBytes = process.env.NEXTCARD_VOICE_MAX_AUDIO_BYTES;

afterEach(async () => {
  vi.unstubAllGlobals();
  restoreEnv("VOLCENGINE_ASR_API_KEY", originalApiKey);
  restoreEnv("NEXTCARD_VOICE_USAGE_FILE", originalUsageFile);
  restoreEnv("NEXTCARD_VOICE_MAX_AUDIO_BYTES", originalMaxAudioBytes);
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("POST /api/backend/voice/transcribe", () => {
  it("rejects oversized audio payloads before calling the ASR provider", async () => {
    process.env.NEXTCARD_VOICE_MAX_AUDIO_BYTES = "8";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      voiceRequest({
        audioBase64: "A".repeat(40),
        durationMs: 1_000,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toBe("BAD_REQUEST");
    expect(body.message).toContain("audioBase64 exceeds");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses provider-returned duration for final quota accounting", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-voice-route-"));
    const usageFile = join(tempDir, "usage.json");
    process.env.NEXTCARD_VOICE_USAGE_FILE = usageFile;
    process.env.VOLCENGINE_ASR_API_KEY = "volc-test-key";
    vi.stubGlobal("fetch", successfulAsrFetch(31_000));

    const response = await POST(
      voiceRequest({
        audioBase64: "UklGRg==",
        durationMs: 1_000,
      }),
    );
    const body = await response.json();
    const records = JSON.parse(await readFile(usageFile, "utf8")) as Array<{ durationMs: number; status: string }>;

    expect(response.status).toBe(429);
    expect(body.error).toBe("QUOTA_EXCEEDED");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ durationMs: 31_000, status: "rejected" });
  });

  it("stores the larger provider duration when transcription is accepted", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-voice-route-"));
    const usageFile = join(tempDir, "usage.json");
    process.env.NEXTCARD_VOICE_USAGE_FILE = usageFile;
    process.env.VOLCENGINE_ASR_API_KEY = "volc-test-key";
    vi.stubGlobal("fetch", successfulAsrFetch(2_500));

    const response = await POST(
      voiceRequest({
        audioBase64: "UklGRg==",
        durationMs: 1_000,
      }),
    );
    const body = await response.json();
    const records = JSON.parse(await readFile(usageFile, "utf8")) as Array<{ durationMs: number; status: string }>;

    expect(response.status).toBe(200);
    expect(body.normalizedText).toBe("关闭透传。");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ durationMs: 2_500, status: "accepted" });
  });
});

function voiceRequest(overrides: Partial<{ audioBase64: string; durationMs: number }> = {}): Request {
  return new Request("http://localhost/api/backend/voice/transcribe", {
    method: "POST",
    body: JSON.stringify({
      anonymousDeviceId: "voice-route-device",
      audioBase64: overrides.audioBase64 ?? "UklGRg==",
      mimeType: "audio/wav",
      durationMs: overrides.durationMs ?? 1_000,
    }),
  });
}

function successfulAsrFetch(durationMs: number): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ audio_info: { duration: durationMs }, result: { text: "关闭透传。" } }), {
      status: 200,
      headers: { "X-Api-Status-Code": "20000000" },
    }),
  ) as unknown as typeof fetch;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

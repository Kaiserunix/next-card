import { describe, expect, it, vi } from "vitest";
import { VolcengineAsrProvider } from "@/lib/server/voice/volcengine-asr-provider";

describe("VolcengineAsrProvider", () => {
  it("sends new-console X-Api-Key headers and returns transcript", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          audio_info: { duration: 2499 },
          result: { text: "关闭透传。", utterances: [] },
        }),
        {
          status: 200,
          headers: {
            "X-Api-Status-Code": "20000000",
            "X-Api-Message": "OK",
          },
        },
      ),
    );
    const provider = new VolcengineAsrProvider(
      {
        apiKey: "volc_key",
        resourceId: "volc.bigasr.auc_turbo",
        endpoint: "https://example.test/recognize",
      },
      fetchMock,
    );

    const transcript = await provider.transcribeAudio({
      audioBase64: "UklGRg==",
      mimeType: "audio/wav",
      durationMs: 2499,
      requestId: "req_1",
      anonymousDeviceId: "device_a",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/recognize",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Api-Key": "volc_key",
          "X-Api-Resource-Id": "volc.bigasr.auc_turbo",
          "X-Api-Request-Id": "req_1",
          "X-Api-Sequence": "-1",
        }),
      }),
    );
    expect(transcript.rawTranscript).toBe("关闭透传。");
    expect(transcript.source).toBe("volcengine-asr");
  });
});

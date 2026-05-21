import type { SpeechToTextInput, SpeechToTextPort } from "@/lib/server/backend-ports";
import type { VolcengineAsrConfig } from "@/lib/server/voice/config";
import { VoiceServiceError } from "@/lib/server/voice/errors";
import type { SpeechTranscript } from "@/lib/server/voice/types";

type FetchLike = typeof fetch;

type VolcengineRecognizeResponse = {
  audio_info?: { duration?: number };
  result?: { text?: string };
};

export class VolcengineAsrProvider implements SpeechToTextPort {
  readonly provider = "volcengine" as const;
  readonly mode = "batch-audio" as const;

  constructor(
    private readonly config: VolcengineAsrConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async transcribeAudio(input: SpeechToTextInput): Promise<SpeechTranscript> {
    if (!this.config.apiKey) {
      throw new VoiceServiceError("CONFIG_MISSING", "VOLCENGINE_ASR_API_KEY is required.", 500);
    }

    const response = await this.fetchImpl(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.config.apiKey,
        "X-Api-Resource-Id": this.config.resourceId,
        "X-Api-Request-Id": input.requestId,
        "X-Api-Sequence": "-1",
      },
      body: JSON.stringify({
        user: { uid: input.anonymousDeviceId },
        audio: { data: input.audioBase64 },
        request: { model_name: "bigmodel" },
      }),
    });

    const statusCode = response.headers.get("X-Api-Status-Code");
    if (!response.ok || statusCode !== "20000000") {
      throw new VoiceServiceError("PROVIDER_FAILED", "Volcengine ASR request failed.", 502);
    }

    const payload = (await response.json()) as VolcengineRecognizeResponse;
    const text = payload.result?.text?.trim();
    if (!text) {
      throw new VoiceServiceError("PROVIDER_FAILED", "Volcengine ASR returned empty text.", 502);
    }

    return {
      id: `tr_${input.requestId}`,
      text,
      rawTranscript: text,
      normalizedText: text,
      source: "volcengine-asr",
      provider: "volcengine",
      language: "zh-CN",
      durationMs: payload.audio_info?.duration ?? input.durationMs,
      confidence: 0.8,
      userConfirmed: false,
      createdAt: new Date().toISOString(),
    };
  }
}

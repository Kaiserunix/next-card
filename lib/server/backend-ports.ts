import type { SpeechTranscript } from "@/lib/server/voice/types";

export type SpeechProviderMode = "batch-audio" | "streaming";

export type SpeechToTextInput = {
  audioBase64: string;
  mimeType: string;
  durationMs: number;
  requestId: string;
  anonymousDeviceId: string;
};

export interface SpeechToTextPort {
  readonly provider: "volcengine" | "aliyun" | "tencent";
  readonly mode: SpeechProviderMode;
  transcribeAudio(input: SpeechToTextInput): Promise<SpeechTranscript>;
  createStreamingSession?(input: unknown): Promise<unknown>;
}

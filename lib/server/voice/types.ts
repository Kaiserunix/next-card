export type SpeechInputSource =
  | "manual-dictation"
  | "web-recording"
  | "web-speech"
  | "android-native"
  | "volcengine-asr"
  | "aliyun-asr"
  | "tencent-asr"
  | "self-hosted-asr"
  | "mimo-asr";

export type SpeechProviderName =
  | "volcengine"
  | "aliyun"
  | "tencent"
  | "manual"
  | "android"
  | "mimo";

export type SpeechTranscript = {
  id: string;
  text: string;
  rawTranscript: string;
  normalizedText: string;
  source: SpeechInputSource;
  provider?: SpeechProviderName;
  language: "zh-CN" | "en" | "mixed" | "auto";
  durationMs?: number;
  confidence?: number;
  userConfirmed: boolean;
  createdAt: string;
};

export type VoicePlanGate = "direct-plan" | "confirm-understanding" | "retry-transcript";

export type VoicePlanReadiness = {
  gate: VoicePlanGate;
  confidence: number;
  reasons: string[];
  understandingPreview?: string;
  missingInfoChips?: string[];
};

export type VoiceUsageLimit = {
  maxDurationMsPerClip: number;
  maxClipsPerDay: number;
  maxTotalDurationMsPerDay: number;
  provider: "volcengine";
};

export type VoiceQuotaSubject = {
  kind: "device" | "user";
  id: string;
};

export type VoiceUsageRecord = {
  id: string;
  subject: VoiceQuotaSubject;
  provider: "volcengine" | "aliyun" | "tencent";
  durationMs: number;
  createdAt: string;
  status: "accepted" | "rejected" | "failed";
};

export type ConfirmedVoiceTranscriptRecord = {
  transcript: SpeechTranscript & { userConfirmed: true };
  anonymousDeviceId: string;
  confirmedAt: string;
};

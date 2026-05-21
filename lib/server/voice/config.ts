import { join } from "node:path";
import type { VoiceUsageLimit } from "@/lib/server/voice/types";

export const DEFAULT_VOICE_USAGE_LIMIT: VoiceUsageLimit = {
  maxDurationMsPerClip: 30_000,
  maxClipsPerDay: 30,
  maxTotalDurationMsPerDay: 600_000,
  provider: "volcengine",
};

export type VolcengineAsrConfig = {
  apiKey: string;
  resourceId: string;
  endpoint: string;
};

export function getVoiceUsageFilePath(): string {
  return process.env.NEXTCARD_VOICE_USAGE_FILE ?? join(process.cwd(), ".nextcard-data", "voice-usage.json");
}

export function getVoiceTranscriptFilePath(): string {
  return process.env.NEXTCARD_VOICE_TRANSCRIPT_FILE ?? join(process.cwd(), ".nextcard-data", "voice-transcripts.json");
}

export function getVolcengineAsrConfig(): VolcengineAsrConfig {
  return {
    apiKey: process.env.VOLCENGINE_ASR_API_KEY ?? "",
    resourceId: process.env.VOLCENGINE_ASR_RESOURCE_ID ?? "volc.bigasr.auc_turbo",
    endpoint:
      process.env.VOLCENGINE_ASR_ENDPOINT ??
      "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash",
  };
}

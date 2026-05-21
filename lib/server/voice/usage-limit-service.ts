import { DEFAULT_VOICE_USAGE_LIMIT } from "@/lib/server/voice/config";
import type { VoiceUsageLimit, VoiceUsageRecord } from "@/lib/server/voice/types";

export type VoiceQuotaCheckInput = {
  durationMs: number;
  existingRecords: VoiceUsageRecord[];
};

export type VoiceQuotaCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export class VoiceUsageLimitService {
  constructor(private readonly limit: VoiceUsageLimit = DEFAULT_VOICE_USAGE_LIMIT) {}

  check(input: VoiceQuotaCheckInput): VoiceQuotaCheckResult {
    if (input.durationMs > this.limit.maxDurationMsPerClip) {
      return { allowed: false, reason: "Single clip exceeds 30 seconds." };
    }

    const accepted = input.existingRecords.filter((record) => record.status === "accepted");
    if (accepted.length >= this.limit.maxClipsPerDay) {
      return { allowed: false, reason: "Daily quota exceeds 30 clips." };
    }

    const usedDuration = accepted.reduce((sum, record) => sum + record.durationMs, 0);
    if (usedDuration + input.durationMs > this.limit.maxTotalDurationMsPerDay) {
      return { allowed: false, reason: "Daily quota exceeds 10 minutes." };
    }

    return { allowed: true };
  }
}

import { randomUUID } from "node:crypto";
import { getVoiceUsageFilePath, getVolcengineAsrConfig } from "@/lib/server/voice/config";
import { toVoiceErrorResponse, VoiceServiceError } from "@/lib/server/voice/errors";
import { normalizeTranscript } from "@/lib/server/voice/normalization-service";
import { optionalNumber, readJsonObject, requireAudioBase64, requireString } from "@/lib/server/voice/request-validation";
import { LocalJsonVoiceUsageRepository } from "@/lib/server/voice/usage-repository";
import { VoiceUsageLimitService } from "@/lib/server/voice/usage-limit-service";
import { VolcengineAsrProvider } from "@/lib/server/voice/volcengine-asr-provider";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const anonymousDeviceId = requireString(payload, "anonymousDeviceId");
    const audioBase64 = requireAudioBase64(payload, "audioBase64");
    const mimeType = requireString(payload, "mimeType");
    const durationMs = optionalNumber(payload, "durationMs") ?? 0;
    if (durationMs <= 0) {
      throw new VoiceServiceError("BAD_REQUEST", "durationMs is required.", 400);
    }

    const subject = { kind: "device" as const, id: anonymousDeviceId };
    const today = new Date().toISOString().slice(0, 10);
    const usageRepository = new LocalJsonVoiceUsageRepository(getVoiceUsageFilePath());
    const existingRecords = await usageRepository.listForSubjectOnDay(subject, today);
    const quota = new VoiceUsageLimitService().check({ durationMs, existingRecords });
    if (!quota.allowed) {
      throw new VoiceServiceError("QUOTA_EXCEEDED", quota.reason, 429);
    }

    const requestId = randomUUID();
    const provider = new VolcengineAsrProvider(getVolcengineAsrConfig());
    const transcript = await provider.transcribeAudio({
      audioBase64,
      mimeType,
      durationMs,
      requestId,
      anonymousDeviceId,
    });
    const providerDurationMs = typeof transcript.durationMs === "number" && Number.isFinite(transcript.durationMs)
      ? transcript.durationMs
      : durationMs;
    const billableDurationMs = Math.max(durationMs, providerDurationMs);
    const providerCheckedQuota = new VoiceUsageLimitService().check({ durationMs: billableDurationMs, existingRecords });
    if (!providerCheckedQuota.allowed) {
      await usageRepository.append({
        id: `usage_${requestId}`,
        subject,
        provider: "volcengine",
        durationMs: billableDurationMs,
        createdAt: new Date().toISOString(),
        status: "rejected",
      });
      throw new VoiceServiceError("QUOTA_EXCEEDED", providerCheckedQuota.reason, 429);
    }
    const normalized = normalizeTranscript(transcript.rawTranscript);

    await usageRepository.append({
      id: `usage_${requestId}`,
      subject,
      provider: "volcengine",
      durationMs: billableDurationMs,
      createdAt: new Date().toISOString(),
      status: "accepted",
    });

    return Response.json({
      ...transcript,
      text: normalized.normalizedText,
      normalizedText: normalized.normalizedText,
      userConfirmed: false,
      normalizationChangedTooMuch: normalized.changedTooMuch,
    });
  } catch (error) {
    return toVoiceErrorResponse(error);
  }
}

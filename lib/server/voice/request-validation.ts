import { VoiceServiceError } from "@/lib/server/voice/errors";

const DEFAULT_MAX_AUDIO_BYTES_PER_CLIP = 8 * 1024 * 1024;

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const payload = (await request.json().catch(() => null)) as unknown;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new VoiceServiceError("BAD_REQUEST", "Request body must be a JSON object.", 400);
  }
  return payload as Record<string, unknown>;
}

export function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new VoiceServiceError("BAD_REQUEST", `${key} is required.`, 400);
  }
  return value;
}

export function requireAudioBase64(payload: Record<string, unknown>, key: string): string {
  const value = requireString(payload, key).trim();
  const base64 = value.startsWith("data:") ? value.slice(value.indexOf(",") + 1) : value;
  const maxAudioBytes = getMaxAudioBytesPerClip();
  const maxBase64Chars = Math.ceil((maxAudioBytes * 4) / 3) + 4;
  if (!base64 || base64.length > maxBase64Chars || estimatedBase64Bytes(base64) > maxAudioBytes) {
    throw new VoiceServiceError("BAD_REQUEST", `audioBase64 exceeds the ${formatBytes(maxAudioBytes)} per-clip limit.`, 413);
  }

  return value;
}

export function optionalNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new VoiceServiceError("BAD_REQUEST", `${key} must be a number.`, 400);
  }
  return value;
}

function estimatedBase64Bytes(value: string): number {
  const sanitized = value.replace(/\s/g, "");
  const padding = sanitized.endsWith("==") ? 2 : sanitized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((sanitized.length * 3) / 4) - padding);
}

function getMaxAudioBytesPerClip(): number {
  const configured = Number(process.env.NEXTCARD_VOICE_MAX_AUDIO_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_AUDIO_BYTES_PER_CLIP;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

export function optionalBoolean(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value === undefined) return false;
  if (typeof value !== "boolean") {
    throw new VoiceServiceError("BAD_REQUEST", `${key} must be a boolean.`, 400);
  }
  return value;
}

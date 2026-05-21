import { VoiceServiceError } from "@/lib/server/voice/errors";

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

export function optionalNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new VoiceServiceError("BAD_REQUEST", `${key} must be a number.`, 400);
  }
  return value;
}

export function optionalBoolean(payload: Record<string, unknown>, key: string): boolean {
  const value = payload[key];
  if (value === undefined) return false;
  if (typeof value !== "boolean") {
    throw new VoiceServiceError("BAD_REQUEST", `${key} must be a boolean.`, 400);
  }
  return value;
}

import { PlanModeServiceError } from "@/lib/server/plan-mode/errors";
import type {
  PlanModeOperation,
  PlanModeRegenerateHint,
  PlanModeRequest,
  PlanModeSource,
} from "@/lib/server/plan-mode/types";

const PLAN_MODE_SOURCES = new Set<PlanModeSource>([
  "voice-confirmed",
  "manual-dictation",
  "text-confirmed",
  "multimodal-confirmed",
]);

const PLAN_MODE_OPERATIONS = new Set<PlanModeOperation>(["generate", "regenerate"]);
const PLAN_MODE_REGENERATE_HINTS = new Set<PlanModeRegenerateHint>([
  "try-again",
  "more-urgent",
  "more-gentle",
  "more-detailed",
]);
const PLAN_MODE_LOCALES = new Set(["zh-CN", "en", "mixed", "auto"]);

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    throw invalid("Request body must be a JSON object.");
  }
  return payload;
}

export function validatePlanModeRequest(input: unknown): PlanModeRequest {
  if (!isRecord(input)) {
    throw invalid("Plan Mode request must be a JSON object.");
  }

  const requestId = requireNonEmptyString(input, "requestId");
  const operation = requireEnum(input, "operation", PLAN_MODE_OPERATIONS);
  const source = requireEnum(input, "source", PLAN_MODE_SOURCES);
  const clientContext = readClientContext(input.clientContext);
  const handoff = input.planCompilerHandoff;

  if (!isRecord(handoff)) {
    throw invalid("planCompilerHandoff is required.");
  }

  const regenerateHint =
    input.regenerateHint === undefined
      ? undefined
      : requireEnum(input, "regenerateHint", PLAN_MODE_REGENERATE_HINTS);

  const previousPlanModeDraftId =
    input.previousPlanModeDraftId === undefined
      ? undefined
      : requireNonEmptyString(input, "previousPlanModeDraftId");

  if (operation === "regenerate" && !previousPlanModeDraftId) {
    throw invalid("previousPlanModeDraftId is required for regenerate.");
  }

  const confirmedTranscriptId =
    input.confirmedTranscriptId === undefined
      ? undefined
      : requireNonEmptyString(input, "confirmedTranscriptId");

  if (source === "voice-confirmed" && !confirmedTranscriptId) {
    throw invalid("confirmedTranscriptId is required for voice-confirmed source.");
  }

  if (handoff.mustGenerateABC !== true) {
    throw notReady("planCompilerHandoff.mustGenerateABC must be true.");
  }

  const verifiedInputBundleId = getNonEmptyString(handoff.verifiedInputBundleId);
  const userFacingSummary = getNonEmptyString(handoff.userFacingSummary);
  if (!verifiedInputBundleId) {
    throw notReady("planCompilerHandoff.verifiedInputBundleId is required.");
  }
  if (!userFacingSummary) {
    throw notReady("planCompilerHandoff.userFacingSummary is required.");
  }

  const anonymousDeviceId =
    input.anonymousDeviceId === undefined ? undefined : requireNonEmptyString(input, "anonymousDeviceId");
  const userId = input.userId === undefined ? undefined : requireNonEmptyString(input, "userId");

  return {
    requestId,
    anonymousDeviceId,
    userId,
    operation,
    source,
    planCompilerHandoff: {
      id: requireHandoffString(handoff, "id"),
      verifiedInputBundleId,
      userFacingSummary,
      constraints: readStringArray(handoff, "constraints"),
      assumptions: readStringArray(handoff, "assumptions"),
      missingButNonBlocking: readStringArray(handoff, "missingButNonBlocking"),
      sourceType: requireHandoffString(handoff, "sourceType") as PlanModeRequest["planCompilerHandoff"]["sourceType"],
      mustGenerateABC: true,
    },
    confirmedTranscriptId,
    previousPlanModeDraftId,
    regenerateHint,
    clientContext,
  };
}

function readClientContext(value: unknown): PlanModeRequest["clientContext"] {
  if (!isRecord(value)) {
    throw invalid("clientContext is required.");
  }
  return {
    now: requireObjectString(value, "now"),
    timezone: requireObjectString(value, "timezone"),
    locale: requireObjectEnum(value, "locale", PLAN_MODE_LOCALES) as PlanModeRequest["clientContext"]["locale"],
  };
}

function readStringArray(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw invalid(`planCompilerHandoff.${key} must be a string array.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function requireHandoffString(payload: Record<string, unknown>, key: string): string {
  const value = getNonEmptyString(payload[key]);
  if (!value) throw notReady(`planCompilerHandoff.${key} is required.`);
  return value;
}

function requireNonEmptyString(payload: Record<string, unknown>, key: string): string {
  return requireObjectString(payload, key);
}

function requireObjectString(payload: Record<string, unknown>, key: string): string {
  const value = getNonEmptyString(payload[key]);
  if (!value) throw invalid(`${key} is required.`);
  return value;
}

function requireEnum<T extends string>(payload: Record<string, unknown>, key: string, allowed: Set<T>): T {
  return requireObjectEnum(payload, key, allowed) as T;
}

function requireObjectEnum<T extends string>(payload: Record<string, unknown>, key: string, allowed: Set<T>): T {
  const value = getNonEmptyString(payload[key]);
  if (!value || !allowed.has(value as T)) {
    throw invalid(`${key} is invalid.`);
  }
  return value as T;
}

function getNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalid(message: string): PlanModeServiceError {
  return new PlanModeServiceError("INVALID_PLAN_MODE_REQUEST", message, 400, true);
}

function notReady(message: string): PlanModeServiceError {
  return new PlanModeServiceError("PLAN_MODE_NOT_READY", message, 409, true);
}

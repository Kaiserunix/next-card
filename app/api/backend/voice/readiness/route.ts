import { toVoiceErrorResponse } from "@/lib/server/voice/errors";
import { optionalBoolean, optionalNumber, readJsonObject, requireString } from "@/lib/server/voice/request-validation";
import { evaluateVoicePlanReadiness } from "@/lib/server/voice/readiness-service";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const normalizedText = requireString(payload, "normalizedText");
    const confidence = optionalNumber(payload, "confidence");
    const normalizationChangedTooMuch = optionalBoolean(payload, "normalizationChangedTooMuch");

    return Response.json(
      evaluateVoicePlanReadiness({
        normalizedText,
        confidence,
        normalizationChangedTooMuch,
      }),
    );
  } catch (error) {
    return toVoiceErrorResponse(error);
  }
}

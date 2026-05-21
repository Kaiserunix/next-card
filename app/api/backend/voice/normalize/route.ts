import { toVoiceErrorResponse } from "@/lib/server/voice/errors";
import { normalizeTranscript } from "@/lib/server/voice/normalization-service";
import { readJsonObject, requireString } from "@/lib/server/voice/request-validation";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const rawTranscript = requireString(payload, "rawTranscript");
    return Response.json(normalizeTranscript(rawTranscript));
  } catch (error) {
    return toVoiceErrorResponse(error);
  }
}

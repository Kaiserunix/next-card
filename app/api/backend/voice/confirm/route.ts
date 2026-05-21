import { getVoiceTranscriptFilePath } from "@/lib/server/voice/config";
import { toVoiceErrorResponse, VoiceServiceError } from "@/lib/server/voice/errors";
import { readJsonObject, requireString } from "@/lib/server/voice/request-validation";
import { LocalJsonVoiceTranscriptRepository } from "@/lib/server/voice/transcript-repository";
import type { SpeechTranscript } from "@/lib/server/voice/types";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const anonymousDeviceId = requireString(payload, "anonymousDeviceId");
    const transcript = payload.transcript as SpeechTranscript | undefined;

    if (!transcript || typeof transcript !== "object") {
      throw new VoiceServiceError("BAD_REQUEST", "transcript is required.", 400);
    }
    if (transcript.userConfirmed !== true) {
      throw new VoiceServiceError("BAD_REQUEST", "Only confirmed transcripts can be saved.", 400);
    }

    const repository = new LocalJsonVoiceTranscriptRepository(getVoiceTranscriptFilePath());
    await repository.append({
      anonymousDeviceId,
      transcript: transcript as SpeechTranscript & { userConfirmed: true },
      confirmedAt: new Date().toISOString(),
    });

    return Response.json({ saved: true });
  } catch (error) {
    return toVoiceErrorResponse(error);
  }
}

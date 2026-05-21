export type VoiceErrorCode =
  | "BAD_REQUEST"
  | "QUOTA_EXCEEDED"
  | "CONFIG_MISSING"
  | "PROVIDER_FAILED";

export class VoiceServiceError extends Error {
  constructor(
    public readonly code: VoiceErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "VoiceServiceError";
  }
}

export function toVoiceErrorResponse(error: unknown): Response {
  if (error instanceof VoiceServiceError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status });
  }

  return Response.json(
    { error: "PROVIDER_FAILED", message: "Voice backend request failed." },
    { status: 500 },
  );
}

import type { PlanModeErrorResponse } from "@/lib/server/plan-mode/types";

export type PlanModeErrorCode = PlanModeErrorResponse["error"];

export type PlanModeError = {
  code: PlanModeErrorCode;
  message: string;
  recoverable?: boolean;
  status?: number;
};

export class PlanModeServiceError extends Error {
  constructor(
    public readonly code: PlanModeErrorCode,
    message: string,
    public readonly status: number,
    public readonly recoverable = true,
  ) {
    super(message);
    this.name = "PlanModeServiceError";
  }
}

export function createPlanModeErrorResponse(error: PlanModeError): PlanModeErrorResponse {
  return {
    error: error.code,
    message: error.message,
    recoverable: error.recoverable ?? true,
  };
}

export function toPlanModeErrorResponse(error: unknown): Response {
  if (error instanceof PlanModeServiceError) {
    return Response.json(createPlanModeErrorResponse(error), { status: error.status });
  }

  return Response.json(
    createPlanModeErrorResponse({
      code: "PROVIDER_FAILED",
      message: "Plan Mode backend request failed.",
      recoverable: true,
    }),
    { status: 500 },
  );
}

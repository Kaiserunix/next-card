import { BackendSandboxRunService } from "@/lib/server/backend-orchestrator/sandbox-run-service";
import { BackendSandboxRunValidationError } from "@/lib/server/backend-orchestrator/sandbox-run-service";
import { readJsonObject } from "@/lib/server/plan-mode/request-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    rejectRouteLocalFilePath(payload);
    const service = new BackendSandboxRunService();
    return Response.json(await service.run(payload));
  } catch (error) {
    return Response.json(
      {
        error: "BACKEND_SANDBOX_RUN_FAILED",
        message: error instanceof Error ? sanitizeError(error.message) : "Backend sandbox run failed.",
        recoverable: true,
      },
      { status: error instanceof BackendSandboxRunValidationError ? 400 : 500 },
    );
  }
}

function rejectRouteLocalFilePath(payload: Record<string, unknown>): void {
  if (typeof payload.filePath !== "string" || payload.filePath.trim().length === 0) return;

  throw new BackendSandboxRunValidationError(
    "filePath is disabled on /api/backend/sandbox/run. Use the CLI sandbox runner for local files or upload through the import route.",
  );
}

function sanitizeError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/tp-[A-Za-z0-9._-]+/g, "tp-[redacted]")
    .replace(/data:[^"'\s]+/g, "data:[redacted]")
    .slice(0, 300);
}

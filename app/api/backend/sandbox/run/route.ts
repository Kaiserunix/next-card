import { BackendSandboxRunService } from "@/lib/server/backend-orchestrator/sandbox-run-service";
import { readJsonObject } from "@/lib/server/plan-mode/request-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const service = new BackendSandboxRunService();
    return Response.json(await service.run(payload));
  } catch (_error) {
    return Response.json(
      {
        error: "BACKEND_SANDBOX_RUN_FAILED",
        message: "Backend sandbox run failed.",
        recoverable: true,
      },
      { status: 500 },
    );
  }
}

import { toPlanModeErrorResponse } from "@/lib/server/plan-mode/errors";
import { PlanModeService } from "@/lib/server/plan-mode/plan-mode-service";
import { readJsonObject } from "@/lib/server/plan-mode/request-validation";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const service = new PlanModeService();
    return Response.json(await service.createDraft(payload));
  } catch (error) {
    return toPlanModeErrorResponse(error);
  }
}

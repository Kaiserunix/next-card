import { CardRuntimeService } from "@/lib/server/card-runtime/card-runtime-service";
import { toCardRuntimeErrorResponse } from "@/lib/server/card-runtime/card-runtime-validator";
import { readJsonObject } from "@/lib/server/plan-mode/request-validation";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await readJsonObject(request);
    const service = new CardRuntimeService();
    return Response.json(await service.applyAction(payload));
  } catch (error) {
    return toCardRuntimeErrorResponse(error);
  }
}

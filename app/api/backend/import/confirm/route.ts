import { ImportConfirmationService, toImportConfirmationErrorResponse } from "@/lib/server/import-review/import-confirmation-service";
import { readJsonObject } from "@/lib/server/plan-mode/request-validation";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await readJsonObject(request);
    const service = new ImportConfirmationService();
    return Response.json(await service.confirm(payload));
  } catch (error) {
    return toImportConfirmationErrorResponse(error);
  }
}

import { DeckCommitService } from "@/lib/server/deck-commit/commit-service";
import { toDeckCommitErrorResponse } from "@/lib/server/deck-commit/commit-validator";
import { readJsonObject } from "@/lib/server/plan-mode/request-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const service = new DeckCommitService();
    return Response.json(await service.commit(payload));
  } catch (error) {
    return toDeckCommitErrorResponse(error);
  }
}

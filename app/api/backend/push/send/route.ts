import { NextResponse } from "next/server";
import { backendPorts } from "@/lib/server/backend-services";
import { readJsonWithLimit, requireInternalRequest } from "@/lib/server/http-guards";
import { validateQueueAction } from "@/lib/server/queue-action-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = requireInternalRequest(request, "Push send API");
  if (unauthorized) {
    return unauthorized;
  }

  const parsed = await readJsonWithLimit<unknown>(request, { label: "push send", maxBytes: 16_384 });
  if (parsed.error) {
    return parsed.error;
  }

  const validation = validateQueueAction(parsed.value, ["create-reminder", "update-reminder"]);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const result = await backendPorts.notifications.createOrUpdate(validation.action);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        providerId: `web-push:${validation.action.targetId}`,
        status: "failed",
        error: error instanceof Error ? error.message : "Push failed"
      },
      { status: 500 }
    );
  }
}

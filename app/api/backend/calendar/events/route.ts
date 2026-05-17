import { NextResponse } from "next/server";
import { backendPorts } from "@/lib/server/backend-services";
import { readJsonWithLimit, requireInternalRequest } from "@/lib/server/http-guards";
import { validateQueueAction } from "@/lib/server/queue-action-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = requireInternalRequest(request, "Calendar event API");
  if (unauthorized) {
    return unauthorized;
  }

  const parsed = await readJsonWithLimit<unknown>(request, { label: "calendar event", maxBytes: 16_384 });
  if (parsed.error) {
    return parsed.error;
  }

  const validation = validateQueueAction(parsed.value, ["create-calendar-event", "update-calendar-event"]);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const result = await backendPorts.calendar.createOrUpdate(validation.action);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        providerId: `ics:${validation.action.targetId}`,
        status: "failed",
        error: error instanceof Error ? error.message : "Calendar failed"
      },
      { status: 500 }
    );
  }
}

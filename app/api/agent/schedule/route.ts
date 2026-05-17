import { NextResponse } from "next/server";
import { enforceRateLimit, readJsonWithLimit } from "@/lib/server/http-guards";
import { toQueueAction, validateScheduleAction } from "@/lib/server/schedule-agent";
import type { AgentScheduleAction } from "@/lib/server/schedule-agent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "agent-schedule", limit: 60, windowMs: 60_000 });
  if (limited) {
    return limited;
  }

  const parsed = await readJsonWithLimit<Partial<AgentScheduleAction>>(request, {
    label: "agent schedule",
    maxBytes: 64_000
  });
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.value;

  if (!body) {
    return NextResponse.json({ errors: ["body is required"] }, { status: 400 });
  }

  const validation = validateScheduleAction(body);

  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 422 });
  }

  const action = body as AgentScheduleAction;

  return NextResponse.json({
    action,
    validation,
    queueAction: toQueueAction(action)
  });
}

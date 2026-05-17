import { NextResponse } from "next/server";
import { backendPorts } from "@/lib/server/backend-services";
import { enforceRateLimit, readJsonWithLimit } from "@/lib/server/http-guards";
import type { SchedulePlannerInput } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "schedule-plan", limit: 60, windowMs: 60_000 });
  if (limited) {
    return limited;
  }

  const parsed = await readJsonWithLimit<Partial<SchedulePlannerInput>>(request, {
    label: "schedule plan",
    maxBytes: 256_000
  });
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.value;

  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "items[] is required" }, { status: 400 });
  }

  const result = await backendPorts.schedulePlanner.plan({
    now: body.now ?? new Date().toISOString(),
    items: body.items,
    activeQueue: body.activeQueue ?? [],
    timeLocks: body.timeLocks ?? [],
    maxDealCards: body.maxDealCards ?? 2
  });

  return NextResponse.json(result);
}

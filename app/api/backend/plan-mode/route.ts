import { NextResponse } from "next/server";
import { backendPorts } from "@/lib/server/backend-services";
import { enforceRateLimit, readJsonWithLimit } from "@/lib/server/http-guards";
import type { PlanModeMessage, SourceType } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "plan-mode", limit: 60, windowMs: 60_000 });
  if (limited) {
    return limited;
  }

  const parsed = await readJsonWithLimit<
    | {
        inputText?: string;
        sourceType?: SourceType;
        parsedText?: string;
        messages?: PlanModeMessage[];
      }
    | null
  >(request, { label: "plan mode", maxBytes: 128_000 });
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.value;

  if (!body || typeof body.inputText !== "string" || !body.inputText.trim()) {
    return NextResponse.json({ error: "inputText is required" }, { status: 400 });
  }

  const result = await backendPorts.aiPlanner.createPlanModeTurn({
    inputText: body.inputText,
    sourceType: body.sourceType ?? "text",
    parsedText: body.parsedText,
    messages: body.messages
  });

  return NextResponse.json(result);
}

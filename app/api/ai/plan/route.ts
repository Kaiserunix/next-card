import { NextResponse } from "next/server";
import { enforceRateLimit, readJsonWithLimit } from "@/lib/server/http-guards";
import { createCompatPlanningBundle } from "@/lib/server/compat-ai-service";
import type { InputsState } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "ai-plan", limit: 60, windowMs: 60_000 });
  if (limited) {
    return limited;
  }

  const parsed = await readJsonWithLimit<{ inputs?: InputsState }>(request, { label: "ai plan", maxBytes: 128_000 });
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.value;

  if (!isInputsState(body?.inputs)) {
    return NextResponse.json({ error: "inputs is required" }, { status: 400 });
  }

  const bundle = await createCompatPlanningBundle(body.inputs);
  return NextResponse.json(bundle);
}

function isInputsState(value: unknown): value is InputsState {
  return typeof value === "object" && value !== null && "text" in value;
}

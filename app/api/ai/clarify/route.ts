import { NextResponse } from "next/server";
import { enforceRateLimit, readJsonWithLimit } from "@/lib/server/http-guards";
import {
  createCompatClarificationTurn,
  type CompatClarificationMessage
} from "@/lib/server/compat-ai-service";
import type { InputsState } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "ai-clarify", limit: 60, windowMs: 60_000 });
  if (limited) {
    return limited;
  }

  const parsed = await readJsonWithLimit<{ inputs?: InputsState; messages?: CompatClarificationMessage[] }>(request, {
    label: "ai clarify",
    maxBytes: 128_000
  });
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.value;

  if (!isInputsState(body?.inputs) || !Array.isArray(body?.messages)) {
    return NextResponse.json({ error: "inputs and messages are required" }, { status: 400 });
  }

  const result = await createCompatClarificationTurn({
    inputs: body.inputs,
    messages: body.messages
  });

  return NextResponse.json(result);
}

function isInputsState(value: unknown): value is InputsState {
  return typeof value === "object" && value !== null && "text" in value;
}

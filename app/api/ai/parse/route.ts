import { NextResponse } from "next/server";
import { enforceRateLimit, readJsonWithLimit } from "@/lib/server/http-guards";
import { createCompatParsedInput, type CompatParseInputRequest } from "@/lib/server/compat-ai-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "ai-parse", limit: 60, windowMs: 60_000 });
  if (limited) {
    return limited;
  }

  const parsed = await readJsonWithLimit<Partial<CompatParseInputRequest>>(request, {
    label: "ai parse",
    maxBytes: 128_000
  });
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.value;

  if (!isParseInput(body)) {
    return NextResponse.json({ error: "kind and name are required" }, { status: 400 });
  }

  const result = await createCompatParsedInput(body);
  return NextResponse.json(result);
}

function isParseInput(value: Partial<CompatParseInputRequest> | null): value is CompatParseInputRequest {
  return (
    Boolean(value) &&
    (value?.kind === "attachment" || value?.kind === "image") &&
    typeof value.name === "string" &&
    value.name.trim().length > 0
  );
}

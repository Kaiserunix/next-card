import { NextResponse } from "next/server";
import { analyzeFrozenTaskReturn } from "@/lib/server/freeze-return-agent";
import { enforceRateLimit, readJsonWithLimit } from "@/lib/server/http-guards";
import type { FrozenTaskEntry, QueueItem, TimeLock } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "freeze-return", limit: 60, windowMs: 60_000 });
  if (limited) {
    return limited;
  }

  const parsed = await readJsonWithLimit<
    | {
        now?: string;
        entry?: FrozenTaskEntry;
        currentQueue?: QueueItem[];
        timeLocks?: TimeLock[];
      }
    | null
  >(request, { label: "freeze return", maxBytes: 256_000 });
  if (parsed.error) {
    return parsed.error;
  }
  const body = parsed.value;

  if (!body?.entry) {
    return NextResponse.json({ error: "entry is required" }, { status: 400 });
  }

  const result = analyzeFrozenTaskReturn({
    now: body.now ?? new Date().toISOString(),
    entry: body.entry,
    currentQueue: body.currentQueue ?? [],
    timeLocks: body.timeLocks ?? []
  });

  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { pushSubscriptionRepository } from "@/lib/server/backend-services";
import { enforceRateLimit, readJsonWithLimit } from "@/lib/server/http-guards";
import { registerPushSubscription } from "@/lib/server/push-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { bucket: "push-subscriptions", limit: 20, windowMs: 60_000 });
  if (limited) {
    return limited;
  }

  const parsed = await readJsonWithLimit<unknown>(request, { label: "push subscription", maxBytes: 16_384 });
  if (parsed.error) {
    return parsed.error;
  }

  try {
    const result = await registerPushSubscription(parsed.value, pushSubscriptionRepository);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid PushSubscription" },
      { status: 400 }
    );
  }
}

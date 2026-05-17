import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

type JsonLimitOptions = {
  label: string;
  maxBytes: number;
};

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalRateLimitState = globalThis as typeof globalThis & {
  __nextCardRateLimits?: Map<string, RateLimitEntry>;
};

export async function readJsonWithLimit<T>(
  request: Request,
  { label, maxBytes }: JsonLimitOptions
): Promise<{ value: T | null; error?: NextResponse }> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      value: null,
      error: NextResponse.json({ error: `${label} body is too large` }, { status: 413 })
    };
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    return {
      value: null,
      error: NextResponse.json({ error: `${label} body is too large` }, { status: 413 })
    };
  }

  if (!raw.trim()) {
    return { value: null };
  }

  try {
    return { value: JSON.parse(raw) as T };
  } catch {
    return {
      value: null,
      error: NextResponse.json({ error: "invalid json" }, { status: 400 })
    };
  }
}

export function requireInternalRequest(request: Request, label = "Internal API") {
  const expected = process.env.NEXT_CARD_INTERNAL_API_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: `${label} is disabled because NEXT_CARD_INTERNAL_API_TOKEN is not configured` },
      { status: 503 }
    );
  }

  const supplied = getSuppliedInternalToken(request);
  if (!supplied || !safeEqual(supplied, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}

export function enforceRateLimit(request: Request, options: RateLimitOptions) {
  const store = globalRateLimitState.__nextCardRateLimits ?? new Map<string, RateLimitEntry>();
  globalRateLimitState.__nextCardRateLimits = store;

  const now = Date.now();
  const key = `${options.bucket}:${getRequestIdentity(request)}`;
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (entry.count >= options.limit) {
    return NextResponse.json(
      { error: "rate limit exceeded", retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) },
      { status: 429 }
    );
  }

  entry.count += 1;
  return null;
}

function getSuppliedInternalToken(request: Request) {
  const direct = request.headers.get("x-next-card-internal-token")?.trim();
  if (direct) {
    return direct;
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getRequestIdentity(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "local";
}

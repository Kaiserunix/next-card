import { afterEach, describe, expect, it } from "vitest";
import { readJsonWithLimit, requireInternalRequest } from "@/lib/server/http-guards";

describe("http guards", () => {
  const originalToken = process.env.NEXT_CARD_INTERNAL_API_TOKEN;

  afterEach(() => {
    process.env.NEXT_CARD_INTERNAL_API_TOKEN = originalToken;
  });

  it("disables internal routes when no server token is configured", async () => {
    delete process.env.NEXT_CARD_INTERNAL_API_TOKEN;

    const response = requireInternalRequest(new Request("http://test.local"), "Worker tick API");

    expect(response?.status).toBe(503);
  });

  it("accepts only matching internal tokens", () => {
    process.env.NEXT_CARD_INTERNAL_API_TOKEN = "secret-token";

    const rejected = requireInternalRequest(
      new Request("http://test.local", { headers: { "x-next-card-internal-token": "wrong" } })
    );
    const accepted = requireInternalRequest(
      new Request("http://test.local", { headers: { authorization: "Bearer secret-token" } })
    );

    expect(rejected?.status).toBe(401);
    expect(accepted).toBeNull();
  });

  it("rejects JSON bodies above the configured byte limit", async () => {
    const request = new Request("http://test.local", {
      method: "POST",
      body: JSON.stringify({ value: "1234567890" })
    });

    const result = await readJsonWithLimit(request, { label: "small", maxBytes: 8 });

    expect(result.error?.status).toBe(413);
  });
});

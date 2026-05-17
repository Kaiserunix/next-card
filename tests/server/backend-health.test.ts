import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/backend/health/route";

describe("backend health route", () => {
  it("reports Mimo AI configuration without leaking secrets", async () => {
    vi.stubEnv("MIMO_API_KEY", "secret-token");
    vi.stubEnv("MIMO_PLANNER_MODEL", "planner-model");
    vi.stubEnv("MIMO_MULTIMODAL_MODEL", "vision-model");

    const body = await GET().json();

    expect(body.providers.ai).toEqual({
      kind: "mimo-openai-compatible",
      configured: true,
      plannerModel: "planner-model",
      multimodalModel: "vision-model",
      strict: false
    });
    expect(body.capabilities).toEqual(expect.arrayContaining(["legacy-ai-compat", "proof-export", "schedule-action-compat"]));
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });
});

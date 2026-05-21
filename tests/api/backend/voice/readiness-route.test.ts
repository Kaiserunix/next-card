import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/voice/readiness/route";

describe("POST /api/backend/voice/readiness", () => {
  it("returns missing-info chips for ambiguous voice input", async () => {
    const response = await POST(
      new Request("http://localhost/api/backend/voice/readiness", {
        method: "POST",
        body: JSON.stringify({
          normalizedText: "明天那个作业。",
          confidence: 0.62,
          normalizationChangedTooMuch: false,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.gate).toBe("confirm-understanding");
    expect(body.missingInfoChips).toContain("具体任务对象");
  });
});

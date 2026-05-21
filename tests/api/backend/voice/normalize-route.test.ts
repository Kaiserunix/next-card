import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/voice/normalize/route";

describe("POST /api/backend/voice/normalize", () => {
  it("normalizes text without storing state", async () => {
    const response = await POST(
      new Request("http://localhost/api/backend/voice/normalize", {
        method: "POST",
        body: JSON.stringify({ rawTranscript: "呃 明天 明天早八高数课提醒我出门" }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.normalizedText).toBe("明天早八高数课提醒我出门。");
  });
});

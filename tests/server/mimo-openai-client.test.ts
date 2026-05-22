import { describe, expect, it } from "vitest";
import { MimoOpenAIClient, getMimoRuntimeConfig } from "@/lib/server/mimo-openai-client";

describe("MimoOpenAIClient", () => {
  it("uses planner and multimodal model defaults without leaking the API key", () => {
    const config = getMimoRuntimeConfig({
      MIMO_API_KEY: "tp-test-secret",
      MIMO_BASE_URL: "https://token-plan-cn.xiaomimimo.com/v1",
    });

    expect(config.configured).toBe(true);
    expect(config.baseUrl).toBe("https://token-plan-cn.xiaomimimo.com/v1");
    expect(config.plannerModel).toBe("mimo-v2.5-pro");
    expect(config.multimodalModel).toBe("mimo-v2.5");
    expect(JSON.stringify(config)).not.toContain("tp-test-secret");
  });

  it("sends OpenAI-compatible image_url content and UTF-8 JSON headers", async () => {
    const requests: Array<{ url: string; init: RequestInit; body: any }> = [];
    const client = new MimoOpenAIClient({
      env: {
        MIMO_API_KEY: "tp-test-secret",
        MIMO_BASE_URL: "https://token-plan-cn.xiaomimimo.com/v1",
        MIMO_MULTIMODAL_MODEL: "mimo-v2.5",
      },
      fetchImpl: async (url, init) => {
        const body = JSON.parse(String(init?.body));
        requests.push({ url: String(url), init: init ?? {}, body });
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "{\"summary\":\"ok\"}" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    const content = await client.createChatCompletion({
      model: "mimo-v2.5",
      messages: [
        { role: "system", content: "read image" },
        {
          role: "user",
          content: [
            { type: "text", text: "parse timetable" },
            { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
          ],
        },
      ],
      responseFormat: "json_object",
    });

    expect(content).toBe("{\"summary\":\"ok\"}");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://token-plan-cn.xiaomimimo.com/v1/chat/completions");
    expect(requests[0].init.headers).toMatchObject({
      Authorization: "Bearer tp-test-secret",
      "Content-Type": "application/json; charset=utf-8",
    });
    expect(requests[0].body.model).toBe("mimo-v2.5");
    expect(requests[0].body.messages[1].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,abc" },
    });
    expect(JSON.stringify({ content })).not.toContain("tp-test-secret");
  });
});

import { describe, expect, it } from "vitest";
import { POST as chatPost } from "@/app/api/chat/route";
import type { ChatMessage } from "@/lib/types";

function request(body: unknown) {
  return new Request("http://next-card.test/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" }
  });
}

function userMessage(text: string): ChatMessage {
  return {
    id: "msg-user-1",
    role: "user",
    text,
    createdAt: "2026-05-17T10:00:00.000Z"
  };
}

describe("chat compatibility route", () => {
  it("validates chat messages before calling a provider", async () => {
    await expect(chatPost(request({}) as never).then((response) => response.status)).resolves.toBe(400);
    await expect(chatPost(request({ messages: [] }) as never).then((response) => response.status)).resolves.toBe(400);
  });

  it("bridges the old /api/chat contract onto the current Plan Mode backend", async () => {
    const response = await chatPost(
      request({
        messages: [userMessage("去高数课，地点西3-T1，10:05上课")],
        contextNote: "用户希望直接生成行动方案。"
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.payload).toMatchObject({
      next_phase: "ready",
      question: null
    });
    expect(body.payload.reply).toEqual(expect.any(String));
    expect(body.payload.analysis_patch.goalUnderstanding).toEqual(expect.any(String));
    expect(body.payload.plans).toHaveLength(3);
    expect(body.payload.plans[0]).toMatchObject({
      id: "plan-1",
      agentId: expect.any(String),
      agentPolicy: expect.objectContaining({
        cardMinuteRange: expect.any(Array)
      })
    });
    expect(["mimo", "local"]).toContain(body.provider);
  });
});

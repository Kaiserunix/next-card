import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/import/route";

let server: ReturnType<typeof createServer> | undefined;
let tempDir: string | undefined;
const originalEnv = {
  MIMO_API_KEY: process.env.MIMO_API_KEY,
  MIMO_BASE_URL: process.env.MIMO_BASE_URL,
  MIMO_MULTIMODAL_MODEL: process.env.MIMO_MULTIMODAL_MODEL,
  NEXTCARD_IMPORT_UPLOAD_DIR: process.env.NEXTCARD_IMPORT_UPLOAD_DIR,
};

afterEach(async () => {
  process.env.MIMO_API_KEY = originalEnv.MIMO_API_KEY;
  process.env.MIMO_BASE_URL = originalEnv.MIMO_BASE_URL;
  process.env.MIMO_MULTIMODAL_MODEL = originalEnv.MIMO_MULTIMODAL_MODEL;
  process.env.NEXTCARD_IMPORT_UPLOAD_DIR = originalEnv.NEXTCARD_IMPORT_UPLOAD_DIR;
  if (server) await new Promise<void>((resolveClose) => server?.close(() => resolveClose()));
  server = undefined;
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("POST /api/backend/import", () => {
  it("returns a light review report for text input", async () => {
    const form = new FormData();
    form.set("sourceType", "text");
    form.set("text", "整理英语作文提纲");
    form.set("sandboxMode", "true");
    form.set("clientContext", JSON.stringify({ now: "2026-05-22T08:00:00.000Z", timezone: "Asia/Shanghai" }));

    const response = await POST(new Request("http://localhost/api/backend/import", { method: "POST", body: form }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reviewGate.requirement).toBe("light");
    expect(body.providerUsage).toMatchObject({ provider: "manual", used: true });
    expect(body.canProceedToPlanMode).toBe(false);
  });

  it("runs image upload through mocked MiMo and returns strict review without leaking the token", async () => {
    await configureMockMimoServer(
      JSON.stringify({
        sourceKind: "courseSchedule",
        extractedEvents: [{ title: "高数", day: "周一", time: "08:00-09:30", location: "三教201" }],
        extractedTimes: [{ label: "周一 08:00-09:30", kind: "hard-lock" }],
        extractedLocations: [{ name: "三教201" }],
        warnings: [],
        needsStrictReview: true,
      }),
    );
    const form = new FormData();
    form.set("sourceType", "image");
    form.set("file", new File([Buffer.from(SMALL_JPG_BASE64, "base64")], "schedule.jpg", { type: "image/jpeg" }));
    form.set("sandboxMode", "true");
    form.set("clientContext", JSON.stringify({ now: "2026-05-22T08:00:00.000Z", timezone: "Asia/Shanghai" }));

    const response = await POST(new Request("http://localhost/api/backend/import", { method: "POST", body: form }));
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(text).not.toContain("tp-test-secret");
    expect(body.providerUsage).toMatchObject({ provider: "mimo", used: true, model: "mimo-v2.5" });
    expect(body.reviewGate.requirement).toBe("strict");
    expect(body.extraction.warnings).toEqual(expect.arrayContaining(["high_risk_multimodal", "course_time"]));
    expect(JSON.stringify(body)).not.toMatch(/committedDeck|proofRecord|reminderJob|profileSnapshot/);
  });

  it("keeps prompt-like image text in strict review instead of executing it", async () => {
    await configureMockMimoServer(
      JSON.stringify({
        sourceKind: "unknown",
        extractedEvents: [],
        extractedTimes: [],
        extractedLocations: [],
        warnings: ["prompt_injection_like_text"],
        needsStrictReview: true,
      }),
    );
    const form = new FormData();
    form.set("sourceType", "image");
    form.set("file", new File([Buffer.from(SMALL_JPG_BASE64, "base64")], "prompt.jpg", { type: "image/jpeg" }));
    form.set("sandboxMode", "true");
    form.set("clientContext", JSON.stringify({ now: "2026-05-22T08:00:00.000Z", timezone: "Asia/Shanghai" }));

    const response = await POST(new Request("http://localhost/api/backend/import", { method: "POST", body: form }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reviewGate.requirement).toBe("blocked");
    expect(body.extraction.warnings).toEqual(expect.arrayContaining(["prompt_injection_like_text", "high_risk_multimodal"]));
    expect(body.canProceedToPlanMode).toBe(false);
  });
});

async function configureMockMimoServer(content: string): Promise<void> {
  tempDir = await mkdtemp(join(tmpdir(), "nextcard-import-route-"));
  process.env.NEXTCARD_IMPORT_UPLOAD_DIR = tempDir;
  process.env.MIMO_API_KEY = "tp-test-secret";
  process.env.MIMO_MULTIMODAL_MODEL = "mimo-v2.5";
  server = createServer((request: IncomingMessage, response: ServerResponse) => {
    request.resume();
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  await new Promise<void>((resolveListen) => server?.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("mock MiMo server did not expose a port");
  process.env.MIMO_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
}

const SMALL_JPG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/ISf/2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQIBAT8QH//EFBQBAQAAAAAAAAAAAAAAAAAAARD/2gAIAQEAAT8QH//Z";

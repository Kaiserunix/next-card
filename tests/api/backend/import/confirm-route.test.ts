import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST as IMPORT_POST } from "@/app/api/backend/import/route";
import { POST as CONFIRM_POST } from "@/app/api/backend/import/confirm/route";

let server: ReturnType<typeof createServer> | undefined;
let tempDir: string | undefined;

const originalEnv = {
  MIMO_API_KEY: process.env.MIMO_API_KEY,
  MIMO_BASE_URL: process.env.MIMO_BASE_URL,
  MIMO_MULTIMODAL_MODEL: process.env.MIMO_MULTIMODAL_MODEL,
  NEXTCARD_IMPORT_UPLOAD_DIR: process.env.NEXTCARD_IMPORT_UPLOAD_DIR,
  NEXTCARD_IMPORT_REVIEW_SESSION_FILE: process.env.NEXTCARD_IMPORT_REVIEW_SESSION_FILE,
};

afterEach(async () => {
  process.env.MIMO_API_KEY = originalEnv.MIMO_API_KEY;
  process.env.MIMO_BASE_URL = originalEnv.MIMO_BASE_URL;
  process.env.MIMO_MULTIMODAL_MODEL = originalEnv.MIMO_MULTIMODAL_MODEL;
  process.env.NEXTCARD_IMPORT_UPLOAD_DIR = originalEnv.NEXTCARD_IMPORT_UPLOAD_DIR;
  process.env.NEXTCARD_IMPORT_REVIEW_SESSION_FILE = originalEnv.NEXTCARD_IMPORT_REVIEW_SESSION_FILE;
  if (server) await new Promise<void>((resolveClose) => server?.close(() => resolveClose()));
  server = undefined;
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("POST /api/backend/import/confirm", () => {
  it("confirms a strict image session and returns a PlanCompilerHandoff without leaking tokens", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-import-confirm-route-"));
    process.env.NEXTCARD_IMPORT_UPLOAD_DIR = tempDir;
    process.env.NEXTCARD_IMPORT_REVIEW_SESSION_FILE = join(tempDir, "sessions.json");
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
    form.set("clientContext", JSON.stringify({ now: "2026-05-22T08:00:00.000Z", timezone: "Asia/Shanghai" }));

    const importResponse = await IMPORT_POST(new Request("http://localhost/api/backend/import", { method: "POST", body: form }));
    const importBody = await importResponse.json();
    expect(importBody.reviewGate.requirement).toBe("strict");
    expect(importBody.canProceedToPlanMode).toBe(false);

    const confirmResponse = await CONFIRM_POST(
      new Request("http://localhost/api/backend/import/confirm", {
        method: "POST",
        body: JSON.stringify({
          reviewSessionId: importBody.reviewSessionId,
          action: "confirm",
          clientContext: { now: "2026-05-22T08:03:00.000Z", timezone: "Asia/Shanghai" },
        }),
      }),
    );
    const text = await confirmResponse.text();
    const body = JSON.parse(text);

    expect(confirmResponse.status).toBe(200);
    expect(body.status).toBe("confirmed");
    expect(body.planCompilerHandoff).toMatchObject({ sourceType: "image", mustGenerateABC: true });
    expect(text).not.toContain("tp-test-secret");
    expect(JSON.stringify(body)).not.toMatch(/committedDeck|proofRecord|reminderJob|profileSnapshot/);
  });
});

async function configureMockMimoServer(content: string): Promise<void> {
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

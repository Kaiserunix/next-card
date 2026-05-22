import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/sandbox/run/route";

let tempDir: string | undefined;
const originalSandboxRoot = process.env.NEXTCARD_SANDBOX_RUN_DIR;
const originalMimoKey = process.env.MIMO_API_KEY;

afterEach(async () => {
  if (originalSandboxRoot === undefined) {
    delete process.env.NEXTCARD_SANDBOX_RUN_DIR;
  } else {
    process.env.NEXTCARD_SANDBOX_RUN_DIR = originalSandboxRoot;
  }
  if (originalMimoKey === undefined) {
    delete process.env.MIMO_API_KEY;
  } else {
    process.env.MIMO_API_KEY = originalMimoKey;
  }
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("POST /api/backend/sandbox/run", () => {
  it("returns a sandbox run report without leaking tokens", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-sandbox-route-"));
    process.env.NEXTCARD_SANDBOX_RUN_DIR = tempDir;
    process.env.MIMO_API_KEY = "tp-test-secret";

    const response = await POST(
      new Request("http://localhost/api/backend/sandbox/run", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "text",
          text: "写英语作文",
          selectedOptionId: "plan-b",
          clientContext: {
            now: "2026-05-22T09:00:00.000Z",
            timezone: "Asia/Shanghai",
          },
        }),
      }),
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.sandbox).toBe(true);
    expect(body.committedDeck.selectedOptionId).toBe("plan-b");
    expect(body.proofTimeline[0].type).toBe("deck_committed");
    expect(serialized).not.toContain("tp-test-secret");
  });

  it("rejects local filePath input on the public HTTP route", async () => {
    const response = await POST(
      new Request("http://localhost/api/backend/sandbox/run", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "image",
          filePath: "C:\\Windows\\win.ini",
          selectedOptionId: "plan-b",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("filePath is disabled");
    expect(body.recoverable).toBe(true);
  });
});

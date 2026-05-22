import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/sandbox/run/route";

let tempDir: string | undefined;
const originalSandboxRoot = process.env.NEXTCARD_SANDBOX_RUN_DIR;

afterEach(async () => {
  if (originalSandboxRoot === undefined) {
    delete process.env.NEXTCARD_SANDBOX_RUN_DIR;
  } else {
    process.env.NEXTCARD_SANDBOX_RUN_DIR = originalSandboxRoot;
  }
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("POST /api/backend/sandbox/run timeline inputs", () => {
  it("accepts timeLocks, availableWindows, and cardActions", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-sandbox-route-time-"));
    process.env.NEXTCARD_SANDBOX_RUN_DIR = tempDir;

    const response = await POST(
      new Request("http://localhost/api/backend/sandbox/run", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "text",
          text: "写英语作文",
          selectedOptionId: "plan-b",
          availableWindows: [window("route_window", "2026-05-22T11:30:00.000Z", "2026-05-22T12:30:00.000Z")],
          timeLocks: [
            {
              id: "route_lock",
              userId: "anon",
              kind: "class_time",
              startAt: "2026-05-22T09:45:00.000Z",
              endAt: "2026-05-22T11:15:00.000Z",
              timezone: "Asia/Shanghai",
              movable: false,
              sourceRefs: [{ rawInputId: "raw_1", quote: "固定上课", confidence: 1 }],
              reviewStatus: "user-confirmed",
              conflictStatus: "none",
            },
          ],
          cardActions: [{ action: "complete", actualMinutes: 4 }],
          clientContext: {
            now: "2026-05-22T09:00:00.000Z",
            timezone: "Asia/Shanghai",
            locale: "zh-CN",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.committedDeck.selectedOptionId).toBe("plan-b");
    expect(body.proofTimeline.map((entry: { type: string }) => entry.type)).toContain("card_completed");
  });

  it("returns a recoverable 400 for invalid time windows", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-sandbox-route-time-"));
    process.env.NEXTCARD_SANDBOX_RUN_DIR = tempDir;

    const response = await POST(
      new Request("http://localhost/api/backend/sandbox/run", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "text",
          text: "写英语作文",
          selectedOptionId: "plan-b",
          availableWindows: [window("bad_window", "not-a-date", "2026-05-22T12:30:00.000Z")],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.recoverable).toBe(true);
    expect(body.message).toContain("valid");
  });
});

function window(id: string, startAt: string, endAt: string) {
  return {
    id,
    startAt,
    endAt,
    timezone: "Asia/Shanghai",
    source: "user-stated",
    confidence: 1,
  };
}

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/backend/plan-mode/route";
import voiceConfirmed from "@/tests/fixtures/plan-mode/voice-confirmed-calculus-handoff.json";
import invalidMissingHandoff from "@/tests/fixtures/plan-mode/invalid-missing-handoff.json";
import invalidVoiceWithoutTranscript from "@/tests/fixtures/plan-mode/invalid-voice-without-transcript-id.json";

let tempDir: string | undefined;
const originalDraftFile = process.env.NEXTCARD_PLAN_MODE_DRAFT_FILE;

afterEach(async () => {
  process.env.NEXTCARD_PLAN_MODE_DRAFT_FILE = originalDraftFile;
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

function planModeRequest(body: unknown): Request {
  return new Request("http://localhost/api/backend/plan-mode", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/backend/plan-mode", () => {
  it("returns an options-ready draft for a valid handoff", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-plan-mode-route-"));
    process.env.NEXTCARD_PLAN_MODE_DRAFT_FILE = join(tempDir, "drafts.json");

    const response = await POST(planModeRequest(voiceConfirmed));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.draft.status).toBe("options-ready");
    expect(body.draft.options.map((option: { mode: string }) => option.mode)).toEqual(["A", "B", "C"]);
    expect(body.draft.writes.deckCommitted).toBe(false);
  });

  it("rejects requests without a PlanCompilerHandoff", async () => {
    const response = await POST(planModeRequest(invalidMissingHandoff));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("INVALID_PLAN_MODE_REQUEST");
    expect(body.recoverable).toBe(true);
  });

  it("rejects voice-confirmed requests without a confirmed transcript id", async () => {
    const response = await POST(planModeRequest(invalidVoiceWithoutTranscript));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("INVALID_PLAN_MODE_REQUEST");
  });
});

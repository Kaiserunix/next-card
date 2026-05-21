import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { LocalJsonVoiceUsageRepository } from "@/lib/server/voice/usage-repository";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("LocalJsonVoiceUsageRepository", () => {
  it("persists and reads usage records", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextcard-voice-"));
    const repo = new LocalJsonVoiceUsageRepository(join(tempDir, "voice-usage.json"));

    await repo.append({
      id: "usage_1",
      subject: { kind: "device", id: "device_a" },
      provider: "volcengine",
      durationMs: 20_000,
      createdAt: "2026-05-21T01:00:00.000Z",
      status: "accepted",
    });

    const records = await repo.listForSubjectOnDay(
      { kind: "device", id: "device_a" },
      "2026-05-21",
    );

    expect(records).toHaveLength(1);
    expect(records[0].durationMs).toBe(20_000);
  });
});

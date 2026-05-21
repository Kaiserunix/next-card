import { describe, expect, it } from "vitest";
import { VoiceUsageLimitService } from "@/lib/server/voice/usage-limit-service";
import type { VoiceUsageRecord } from "@/lib/server/voice/types";

const baseRecord: VoiceUsageRecord = {
  id: "usage_1",
  subject: { kind: "device", id: "device_a" },
  provider: "volcengine",
  durationMs: 30_000,
  createdAt: "2026-05-21T01:00:00.000Z",
  status: "accepted",
};

describe("VoiceUsageLimitService", () => {
  it("rejects clips longer than 30 seconds", () => {
    const service = new VoiceUsageLimitService();

    const result = service.check({ durationMs: 31_000, existingRecords: [] });

    if (result.allowed) throw new Error("Expected quota check to reject the clip.");
    expect(result.reason).toContain("30 seconds");
  });

  it("rejects the 31st accepted clip in one day", () => {
    const service = new VoiceUsageLimitService();
    const existingRecords = Array.from({ length: 30 }, (_, index) => ({
      ...baseRecord,
      id: `usage_${index}`,
    }));

    const result = service.check({ durationMs: 1_000, existingRecords });

    if (result.allowed) throw new Error("Expected quota check to reject the 31st clip.");
    expect(result.reason).toContain("30 clips");
  });

  it("does not count failed provider attempts toward daily accepted quota", () => {
    const service = new VoiceUsageLimitService();
    const existingRecords = [{ ...baseRecord, status: "failed" as const }];

    const result = service.check({ durationMs: 1_000, existingRecords });

    expect(result.allowed).toBe(true);
  });
});

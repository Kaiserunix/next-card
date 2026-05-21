import { describe, expect, it } from "vitest";
import { normalizeTranscript } from "@/lib/server/voice/normalization-service";

describe("normalizeTranscript", () => {
  it("removes filler words and duplicated starts without changing intent", () => {
    const result = normalizeTranscript("呃呃 明天 明天早八高数课提醒我出门");

    expect(result.normalizedText).toBe("明天早八高数课提醒我出门。");
    expect(result.changedTooMuch).toBe(false);
  });

  it("keeps short ambiguous input visible for readiness instead of inventing details", () => {
    const result = normalizeTranscript("那个作业");

    expect(result.normalizedText).toBe("那个作业。");
    expect(result.changedTooMuch).toBe(false);
  });
});

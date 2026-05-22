import { describe, expect, it } from "vitest";
import { evaluateInputReadiness, toFactConfirmationRequest } from "@/lib/server/input-layer/readiness-service";
import { extractTextInput } from "@/lib/server/input-layer/text-extraction-worker";
import type { RawInput } from "@/lib/server/input-layer/types";

describe("evaluateInputReadiness", () => {
  it("uses lightweight chips for go-to-calculus without inventing time or location", () => {
    const rawInput = raw("text", "去高数课");
    const extraction = extractTextInput(rawInput);
    const readiness = evaluateInputReadiness({ rawInput, extraction });

    expect(readiness.gate).toBe("needs-light-clarification");
    expect(readiness.missingFields).toEqual(expect.arrayContaining(["time", "location"]));
    expect(readiness.suggestedChips.map((chip) => chip.field)).toEqual(expect.arrayContaining(["time", "location"]));
  });

  it("allows explicit assignment deadline into a light fact confirmation card", () => {
    const rawInput = raw("manual-dictation", "今晚八点前交英语作文");
    const extraction = extractTextInput(rawInput);
    const readiness = evaluateInputReadiness({ rawInput, extraction });
    const request = toFactConfirmationRequest(rawInput, extraction, readiness);

    expect(readiness.gate).toBe("ready-for-fact-confirmation");
    expect(request.mode).toBe("light-card");
    expect(request.canProceedToPlanMode).toBe(false);
  });

  it("does not force plans for unresolved references", () => {
    const rawInput = raw("voice", "明天那个作业提醒我一下");
    const extraction = extractTextInput(rawInput);
    const readiness = evaluateInputReadiness({ rawInput, extraction });

    expect(readiness.gate).toBe("needs-light-clarification");
    expect(readiness.missingFields).toContain("event");
  });
});

function raw(sourceType: RawInput["sourceType"], text: string): RawInput {
  return {
    id: `raw_${sourceType}`,
    sourceType,
    text,
    sourceHash: "b".repeat(64),
    locale: "zh-CN",
    createdAt: "2026-05-21T08:00:00.000Z",
    receivedAt: "2026-05-21T08:00:00.000Z",
    privacyFlags: [],
    retentionPolicy: {
      rawRetentionDays: 7,
      derivedRetentionDays: 30,
      userDeletable: true,
    },
  };
}

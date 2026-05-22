import { describe, expect, it } from "vitest";
import { DeterministicPlanModeProvider } from "@/lib/server/plan-mode/deterministic-plan-provider";
import { isBroadActionCard, validatePlanModeDraft } from "@/lib/server/plan-mode/plan-output-validator";
import type { PlanModeRequest } from "@/lib/server/plan-mode/types";
import voiceConfirmed from "@/tests/fixtures/plan-mode/voice-confirmed-calculus-handoff.json";

describe("DeterministicPlanModeProvider", () => {
  it("generates stable A/B/C options with decomposed action cards", async () => {
    const provider = new DeterministicPlanModeProvider();
    const input = {
      request: voiceConfirmed as PlanModeRequest,
      createdAt: "2026-05-21T12:00:00.000Z",
    };

    const first = await provider.generatePlanModeDraft(input);
    const second = await provider.generatePlanModeDraft(input);

    expect(first).toEqual(second);
    expect(first.draft.provider).toBe("deterministic-local");
    expect(first.draft.options.map((option) => [option.id, option.mode, option.style])).toEqual([
      ["plan-a", "A", "urgent"],
      ["plan-b", "B", "balanced"],
      ["plan-c", "C", "gentle"],
    ]);

    for (const option of first.draft.options) {
      expect(option.cardDrafts.length).toBeGreaterThanOrEqual(3);
      expect(option.cardDrafts.some(isBroadActionCard)).toBe(false);
    }

    expect(validatePlanModeDraft(first.draft)).toBe(first.draft);
  });
});

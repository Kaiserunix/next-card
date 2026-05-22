import { describe, expect, it } from "vitest";
import {
  assertPlanModeNoAuthorityWrites,
  isBroadActionCard,
  validatePlanModeDraft,
} from "@/lib/server/plan-mode/plan-output-validator";
import type { PlanModeProviderOutput } from "@/lib/server/plan-mode/types";
import validProviderOutput from "@/tests/fixtures/plan-mode/provider-output-valid-abc.json";
import missingCProviderOutput from "@/tests/fixtures/plan-mode/provider-output-missing-c.json";
import broadCardProviderOutput from "@/tests/fixtures/plan-mode/provider-output-broad-card.json";

describe("validatePlanModeDraft", () => {
  it("accepts a safe A/B/C draft", () => {
    const draft = (validProviderOutput as unknown as PlanModeProviderOutput).draft;

    expect(validatePlanModeDraft(draft)).toBe(draft);
    expect(() => assertPlanModeNoAuthorityWrites(draft)).not.toThrow();
  });

  it("rejects provider output missing option C", () => {
    const draft = (missingCProviderOutput as unknown as PlanModeProviderOutput).draft;

    expect(() => validatePlanModeDraft(draft)).toThrow(/exactly three/);
  });

  it("rejects broad action cards", () => {
    const draft = (broadCardProviderOutput as unknown as PlanModeProviderOutput).draft;

    expect(isBroadActionCard(draft.options[0].cardDrafts[0])).toBe(true);
    expect(() => validatePlanModeDraft(draft)).toThrow(/broad/);
  });
});

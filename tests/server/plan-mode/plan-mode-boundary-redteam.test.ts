import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validatePlanModeDraft } from "@/lib/server/plan-mode/plan-output-validator";
import type { PlanModeDraft, PlanModeProviderOutput } from "@/lib/server/plan-mode/types";
import validProviderOutput from "@/tests/fixtures/plan-mode/provider-output-valid-abc.json";

function cloneDraft(): PlanModeDraft {
  return structuredClone((validProviderOutput as unknown as PlanModeProviderOutput).draft);
}

describe("plan mode authority boundary redteam", () => {
  it("rejects duplicated option modes", () => {
    const draft = cloneDraft();
    draft.options[2].mode = "B";

    expect(() => validatePlanModeDraft(draft)).toThrow(/option modes/);
  });

  it("rejects provider output with four options", () => {
    const draft = cloneDraft() as unknown as { options: unknown[] };
    draft.options = [...draft.options, draft.options[2]];

    expect(() => validatePlanModeDraft(draft as PlanModeDraft)).toThrow(/exactly three/);
  });

  it("rejects selected option markers", () => {
    const draft = cloneDraft() as PlanModeDraft & { selectedOptionId?: string };
    draft.selectedOptionId = "plan-a";

    expect(() => validatePlanModeDraft(draft)).toThrow(/selected/);
  });

  it.each([
    ["deckCommitted", "deck"],
    ["proofWritten", "proof"],
    ["remindersCreated", "reminder"],
    ["scheduleQueued", "schedule"],
  ] as const)("rejects %s authority writes", (flag, _label) => {
    const draft = cloneDraft();
    (draft.writes as unknown as Record<typeof flag, boolean>)[flag] = true;

    expect(() => validatePlanModeDraft(draft)).toThrow(/authority writes/);
  });

  it("rejects schedule hints that imply an unchosen plan was queued", () => {
    const draft = cloneDraft() as PlanModeDraft & { scheduleQueuedForOptionId?: string };
    draft.scheduleQueuedForOptionId = "plan-a";

    expect(() => validatePlanModeDraft(draft)).toThrow(/schedule/i);
  });

  it("rejects invented hard-time fields outside source constraints", () => {
    const draft = cloneDraft() as PlanModeDraft & { normalizedDeadlineAt?: string };
    draft.normalizedDeadlineAt = "2026-05-22T08:00:00+08:00";

    expect(() => validatePlanModeDraft(draft)).toThrow(/deadline/i);
  });

  it("keeps route and service imports away from deck/proof/reminder/schedule writers", async () => {
    const routeSource = await readFile(join(process.cwd(), "app/api/backend/plan-mode/route.ts"), "utf8");
    const serviceSource = await readFile(join(process.cwd(), "lib/server/plan-mode/plan-mode-service.ts"), "utf8");
    const combined = `${routeSource}\n${serviceSource}`;

    expect(combined).not.toMatch(/proof|reminder|time-guardian|deck-commit|queue-writer|schedule-writer/i);
  });
});

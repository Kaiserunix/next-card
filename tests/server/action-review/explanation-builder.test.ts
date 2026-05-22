import { describe, expect, it } from "vitest";

import { buildProfileExplanation } from "@/lib/server/action-review/explanation-builder";
import { buildDefaultProfile } from "@/lib/server/action-review/profile-aggregator";
import { buildPolicySnapshot } from "@/lib/server/action-review/policy-engine";
import { expectSupportCopy } from "./test-utils";

describe("buildProfileExplanation", () => {
  it("creates support-language copy for smaller first cards", () => {
    const profile = buildDefaultProfile("user-demo");
    const policy = buildPolicySnapshot(profile, { preset: "low-pressure-start" });

    const explanation = buildProfileExplanation(policy);

    expect(explanation.messages.join("\n")).toContain("更短");
    expect(explanation.explains).toContain("future-first-step-size");
    expectSupportCopy(explanation);
  });

  it("does not expose hidden agent layers", () => {
    const profile = buildDefaultProfile("user-demo");
    const policy = buildPolicySnapshot(profile, { preset: "more-buffer" });

    const explanation = buildProfileExplanation(policy);

    expect(explanation.messages.join("\n")).not.toMatch(/agent|行动回顾层|节奏适配层/i);
    expectSupportCopy(explanation);
  });
});

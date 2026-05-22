import { randomUUID } from "node:crypto";
import type { PlanCompilerHandoff, VerifiedInputBundle } from "@/lib/server/input-layer/types";

export function createPlanCompilerHandoff(bundle: VerifiedInputBundle): PlanCompilerHandoff {
  if (!bundle.readyForPlanCompiler) {
    throw new Error(`Verified input bundle ${bundle.id} is not ready for Plan Compiler`);
  }

  return {
    id: `handoff_${randomUUID()}`,
    verifiedInputBundleId: bundle.id,
    userFacingSummary: buildSummary(bundle),
    constraints: buildConstraints(bundle),
    assumptions: buildAssumptions(bundle),
    missingButNonBlocking: bundle.missingButNonBlocking ?? [],
    sourceType: bundle.sourceType ?? "text",
    mustGenerateABC: true,
  };
}

function buildSummary(bundle: VerifiedInputBundle): string {
  const tasks = bundle.verifiedTaskFacts.map((fact) => fact.title).join("、") || "待规划任务";
  const times = bundle.verifiedTimeFacts.map((fact) => fact.label).join("、");
  return times ? `${tasks}；时间约束：${times}` : tasks;
}

function buildConstraints(bundle: VerifiedInputBundle): string[] {
  return bundle.verifiedTimeFacts.map((fact) => {
    if (fact.kind === "deadline") return `deadline: ${fact.label}`;
    if (fact.kind === "hard-lock") return `hard-lock: ${fact.label}`;
    return `${fact.kind}: ${fact.label}`;
  });
}

function buildAssumptions(bundle: VerifiedInputBundle): string[] {
  return [`lifecycle: ${bundle.lifecycle}`, `tension: ${bundle.tensionLevel}`];
}

import { compareIso } from "./time-overlap";
import type { AgentPolicySnapshot, DeadlineWarning, FrozenQueueItem, ScheduleSnapshot } from "./types";

export type FrozenQueueDecision = "reinsert-today" | "reinsert-tomorrow" | "keep-frozen" | "needs-review" | "smaller-first-step";

export type FrozenQueuePolicyResult = {
  decision: FrozenQueueDecision;
  reason: string;
};

export function chooseFrozenQueuePolicy(input: {
  snapshot: ScheduleSnapshot;
  item: FrozenQueueItem;
  deadlineWarning?: DeadlineWarning;
  policySnapshot?: AgentPolicySnapshot;
}): FrozenQueuePolicyResult {
  if (input.deadlineWarning && ["risk", "critical"].includes(input.deadlineWarning.level)) {
    return {
      decision: "needs-review",
      reason: `Frozen card deadline risk changed: ${input.deadlineWarning.reason}`,
    };
  }

  const estimatedMinutes = input.item.estimatedMinutes ?? 10;
  const safeWindow = input.snapshot.availableWindows.find((window) => {
    const durationMs = Date.parse(window.endAt) - Date.parse(window.startAt);
    return durationMs >= estimatedMinutes * 60_000 && compareIso(window.startAt, input.snapshot.now) >= 0;
  });

  if (safeWindow) {
    const today = input.snapshot.now.slice(0, 10);
    return {
      decision: safeWindow.startAt.startsWith(today) ? "reinsert-today" : "reinsert-tomorrow",
      reason: "A safe window exists for frozen card return.",
    };
  }

  if (input.policySnapshot?.cardGranularity === "micro") {
    return {
      decision: "smaller-first-step",
      reason: "Policy suggests a smaller first step before reinsertion.",
    };
  }

  return {
    decision: "keep-frozen",
    reason: "No safe return window is available yet.",
  };
}

import { describe, expect, it } from "vitest";
import {
  AGENT_AUTO_TRIGGERS,
  AGENT_LAYER_EDGES,
  AGENT_SKILLS,
  buildAgentRuntimePlan,
  getAgentRuntimeProfile
} from "@/lib/server/agent-runtime";
import type { AgentId } from "@/lib/types";

const agentIds: AgentId[] = [
  "balanced-coach",
  "deadline-guardian",
  "micro-splitter",
  "sprint-driver",
  "gentle-recovery",
  "meaning-coach"
];

describe("agent runtime architecture", () => {
  it("defines a three-layer pipeline where Mimo plans, orchestrator mutates queue, and profiles tune behavior", () => {
    expect(AGENT_LAYER_EDGES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "mimo-backend",
          to: "queue-orchestrator",
          handoff: "PlanModeTurnResult | ImportReviewResult"
        }),
        expect.objectContaining({
          from: "behavior-profile",
          to: "queue-orchestrator",
          handoff: "AgentPolicy + skillWeights"
        })
      ])
    );
    expect(AGENT_SKILLS["goal-plan"].layer).toBe("mimo-backend");
    expect(AGENT_SKILLS["time-lock-guard"].layer).toBe("queue-orchestrator");
    expect(AGENT_SKILLS["micro-decompose"].layer).toBe("behavior-profile");
    expect(AGENT_SKILLS["time-lock-guard"].canMutateQueue).toBe(false);
  });

  it("assigns skill weights to every local behavior agent profile", () => {
    for (const agentId of agentIds) {
      const profile = getAgentRuntimeProfile(agentId);

      expect(profile.id).toBe(agentId);
      expect(profile.skillWeights["micro-decompose"]).toBeGreaterThan(0);
      expect(profile.skillWeights["proof-writing"]).toBeGreaterThan(0);
      expect(profile.primarySkills.length).toBeGreaterThanOrEqual(3);
    }

    expect(getAgentRuntimeProfile("deadline-guardian").skillWeights["deadline-protect"]).toBeGreaterThan(
      getAgentRuntimeProfile("gentle-recovery").skillWeights["deadline-protect"]
    );
    expect(getAgentRuntimeProfile("gentle-recovery").skillWeights["freeze-recovery"]).toBeGreaterThan(
      getAgentRuntimeProfile("deadline-guardian").skillWeights["freeze-recovery"]
    );
    expect(getAgentRuntimeProfile("meaning-coach").skillWeights["meaning-reframe"]).toBeGreaterThanOrEqual(0.9);
    expect(getAgentRuntimeProfile("micro-splitter").skillWeights["micro-decompose"]).toBeGreaterThanOrEqual(0.9);
  });

  it("runs time-lock guard before queue mutation in scheduled worker ticks", () => {
    const plan = buildAgentRuntimePlan({
      trigger: "worker-tick",
      agentId: "deadline-guardian",
      now: "2026-05-17T08:00:00.000Z"
    });
    const guardIndex = plan.skillOrder.indexOf("time-lock-guard");
    const insertIndex = plan.skillOrder.indexOf("schedule-insert");

    expect(plan.trigger.kind).toBe("worker-tick");
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(guardIndex);
    expect(plan.queueActions).toEqual(
      expect.arrayContaining(["insert-task", "move-task", "deal-card", "create-reminder", "create-calendar-event"])
    );
    expect(plan.guards).toContain("hard-time-locks-are-suggest-only");
  });

  it("forces review gate for large multimodal imports before cards enter the queue", () => {
    const plan = buildAgentRuntimePlan({
      trigger: "large-import-received",
      agentId: "micro-splitter",
      sourceType: "image"
    });

    expect(plan.skillOrder.slice(0, 3)).toEqual(["multimodal-import", "coverage-review", "review-gate"]);
    expect(plan.requiresUserReview).toBe(true);
    expect(plan.queueActions).toEqual(["reveal-hidden-goal", "deal-card"]);
  });

  it("routes due frozen cards through freeze return analysis before dealing another card", () => {
    const plan = buildAgentRuntimePlan({
      trigger: "freeze-return-due",
      agentId: "gentle-recovery",
      now: "2026-05-17T09:00:00.000Z"
    });

    expect(plan.skillOrder).toEqual(
      expect.arrayContaining(["freeze-return", "priority-score", "time-lock-guard", "schedule-insert"])
    );
    expect(plan.skillOrder.indexOf("freeze-return")).toBeLessThan(plan.skillOrder.indexOf("schedule-insert"));
    expect(plan.queueActions).toEqual(expect.arrayContaining(["return-frozen-card", "split-frozen-card", "keep-waiting"]));
  });

  it("declares automatic triggers for user events, worker ticks, and urgency thresholds", () => {
    expect(AGENT_AUTO_TRIGGERS.map((trigger) => trigger.kind)).toEqual(
      expect.arrayContaining(["goal-submitted", "large-import-received", "worker-tick", "freeze-return-due", "urgency-threshold"])
    );
    expect(AGENT_AUTO_TRIGGERS.find((trigger) => trigger.kind === "worker-tick")).toMatchObject({
      cadence: "every-5-minutes",
      background: true
    });
  });
});

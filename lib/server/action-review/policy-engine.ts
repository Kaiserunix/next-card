import type {
  AgentPolicyAllowedInfluence,
  AgentPolicyForbiddenInfluence,
  AgentPolicySnapshot,
  ProfilePreferencePreset,
  ProfileSnapshot,
} from "./types";

type BuildPolicyOptions = {
  preset?: ProfilePreferencePreset;
  now?: string;
  appliesTo?: AgentPolicySnapshot["appliesTo"];
};

const allowedInfluence: AgentPolicyAllowedInfluence[] = [
  "future-first-card-size",
  "future-card-minute-range",
  "future-buffer-size",
  "future-reminder-tone",
  "future-nudge-daily-cap",
  "future-burn-sensitivity",
  "future-freeze-recovery-style",
  "future-optional-continuation",
];

const forbiddenInfluence: AgentPolicyForbiddenInfluence[] = [
  "deadline",
  "hard-lock",
  "baseline-reminder-existence",
  "chosen-plan-override",
  "proof",
  "baseline-goal",
  "standard-goal",
  "committed-deck-card-reminder",
];

export function buildPolicySnapshot(profile: ProfileSnapshot, options: BuildPolicyOptions = {}): AgentPolicySnapshot {
  const preset = options.preset ?? "default-balanced";
  const now = options.now ?? new Date().toISOString();
  const presetPolicy = presetToPolicy(preset);

  return {
    id: `policy_${profile.id}_v1_${preset}`,
    profileSnapshotId: profile.id,
    version: 1,
    createdAt: now,
    appliesTo: options.appliesTo ?? "future-planning-only",
    ...presetPolicy,
    allowedInfluence,
    forbiddenInfluence,
  };
}

function presetToPolicy(
  preset: ProfilePreferencePreset,
): Pick<
  AgentPolicySnapshot,
  | "planIntensity"
  | "cardGranularity"
  | "cardMinuteRange"
  | "bufferMultiplier"
  | "reminderStrictness"
  | "nudgeDailyCap"
  | "burnSensitivity"
  | "freezeRecoveryStyle"
  | "optionalContinuationCards"
  | "explanation"
> {
  switch (preset) {
    case "low-pressure-start":
      return {
        planIntensity: "minimal",
        cardGranularity: "micro",
        cardMinuteRange: [3, 8],
        bufferMultiplier: 1.2,
        reminderStrictness: "light",
        nudgeDailyCap: 1,
        burnSensitivity: 0.8,
        freezeRecoveryStyle: "smaller-first-card",
        optionalContinuationCards: true,
        explanation: "后续计划先放更短的启动卡，只作为未来建议。",
      };
    case "short-card-focus":
      return {
        planIntensity: "balanced",
        cardGranularity: "micro",
        cardMinuteRange: [5, 12],
        bufferMultiplier: 1.1,
        reminderStrictness: "normal",
        nudgeDailyCap: 2,
        burnSensitivity: 1,
        freezeRecoveryStyle: "smaller-first-card",
        optionalContinuationCards: true,
        explanation: "后续计划优先使用短卡开头，保持标准目标不变。",
      };
    case "more-buffer":
      return {
        planIntensity: "balanced",
        cardGranularity: "standard",
        cardMinuteRange: [8, 18],
        bufferMultiplier: 1.4,
        reminderStrictness: "normal",
        nudgeDailyCap: 2,
        burnSensitivity: 0.9,
        freezeRecoveryStyle: "resume-context",
        optionalContinuationCards: true,
        explanation: "后续计划多留缓冲时间，保护固定时间与原目标。",
      };
    case "light-reminders":
      return {
        planIntensity: "balanced",
        cardGranularity: "standard",
        cardMinuteRange: [8, 18],
        bufferMultiplier: 1.15,
        reminderStrictness: "light",
        nudgeDailyCap: 1,
        burnSensitivity: 0.85,
        freezeRecoveryStyle: "resume-context",
        optionalContinuationCards: true,
        explanation: "后续提醒保持轻量，只保留关键节点。",
      };
    case "default-balanced":
    default:
      return {
        planIntensity: "balanced",
        cardGranularity: "standard",
        cardMinuteRange: [8, 18],
        bufferMultiplier: 1.15,
        reminderStrictness: "normal",
        nudgeDailyCap: 2,
        burnSensitivity: 1,
        freezeRecoveryStyle: "resume-context",
        optionalContinuationCards: true,
        explanation: "后续计划保持均衡节奏，卡片大小和提醒强度只作为未来建议。",
      };
  }
}

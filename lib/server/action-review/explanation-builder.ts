import type { AgentPolicySnapshot, ProfileExplanation } from "./types";

export function buildProfileExplanation(
  policy: AgentPolicySnapshot,
  now = new Date().toISOString(),
): ProfileExplanation {
  const messages: string[] = [];
  const explains: ProfileExplanation["explains"] = ["future-planning-hint"];

  if (policy.cardGranularity === "micro") {
    messages.push("这次先给你一张更短的启动卡。");
    explains.push("future-first-step-size");
  }

  if (policy.bufferMultiplier >= 1.25) {
    messages.push("这个任务会多留一点缓冲时间。");
    explains.push("future-buffer-preference");
  }

  if (policy.reminderStrictness === "light") {
    messages.push("这次提醒会轻一点，只保留关键节点。");
    explains.push("future-reminder-tone");
  }

  if (policy.freezeRecoveryStyle === "smaller-first-card") {
    messages.push("这张卡适合先恢复上下文，再继续。");
    explains.push("future-freeze-recovery");
  }

  if (messages.length === 0) {
    messages.push("后续卡片会保持均衡大小和正常提醒。");
  }

  return {
    id: `explanation_${policy.id}`,
    profileSnapshotId: policy.profileSnapshotId,
    policySnapshotId: policy.id,
    createdAt: now,
    surface: "card-reason",
    explains: [...new Set(explains)],
    messages,
  };
}

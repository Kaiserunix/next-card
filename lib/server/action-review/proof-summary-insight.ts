import type { AgentPolicySnapshot, ProfileSnapshot, ProofSignalAggregate, ProofSummaryInsight } from "./types";

export function buildProofSummaryInsight(
  aggregate: ProofSignalAggregate,
  profile: ProfileSnapshot,
  policy: AgentPolicySnapshot,
  now = new Date().toISOString(),
): ProofSummaryInsight {
  if (!aggregate.dataQuality.hasEnoughData) {
    return {
      id: `insight_${aggregate.id}`,
      aggregateId: aggregate.id,
      profileSnapshotId: profile.id,
      policySnapshotId: policy.id,
      createdAt: now,
      summary: "还没有足够的行动证据，先保持默认的卡片和提醒设置。",
      highlights: [],
      nextSupportSuggestion: "继续完成一两张卡后，再给出更贴近当下的支持建议。",
      evidenceIds: aggregate.evidenceEventIds,
      confidence: 0,
    };
  }

  const highlights: string[] = [];
  if ((aggregate.signals.shortCardCompletionRate ?? 0) >= 0.8) {
    highlights.push("短卡片作为开头时推进更顺。");
  }
  if ((aggregate.signals.freezeRate ?? 0) > 0) {
    highlights.push("有卡片被先冻结，恢复上下文类卡片会更稳。");
  }
  if ((aggregate.signals.burnCompletionRate ?? 0) > 0) {
    highlights.push("燃烧提醒后仍有完成记录，压力提示适合保持为提醒而非阻断。");
  }
  if ((aggregate.signals.actualVsEstimatedRatio ?? 0) >= 1.25) {
    highlights.push("实际用时略高于估计，后续可以多留缓冲。");
  }

  const nextSupportSuggestion =
    policy.cardGranularity === "micro" || (aggregate.signals.shortCardCompletionRate ?? 0) >= 0.8
      ? "下次可以先放一张 5-10 分钟的短卡。"
      : "下次继续用一张清晰启动卡接住当前目标。";

  return {
    id: `insight_${aggregate.id}`,
    aggregateId: aggregate.id,
    profileSnapshotId: profile.id,
    policySnapshotId: policy.id,
    createdAt: now,
    summary: `这段证据包含 ${aggregate.dataQuality.evidenceCount} 个已确认行动事件，可用于后续卡片粒度和提醒语气的轻量建议。`,
    highlights,
    nextSupportSuggestion,
    evidenceIds: aggregate.evidenceEventIds,
    confidence: Math.min(0.75, aggregate.dataQuality.evidenceCount / 12),
  };
}

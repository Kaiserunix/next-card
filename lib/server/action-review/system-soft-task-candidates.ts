import type { ProfileSnapshot, ProofSummaryInsight, SystemSoftTaskCandidate } from "./types";

export function generateSoftTaskCandidates(
  profile: ProfileSnapshot,
  proofInsights: ProofSummaryInsight | readonly ProofSummaryInsight[],
): SystemSoftTaskCandidate[] {
  if (profile.mode === "default") return [];

  const insights = Array.isArray(proofInsights) ? proofInsights : [proofInsights];
  const evidenceIds = [...new Set([...profile.evidenceIds, ...insights.flatMap((insight) => insight.evidenceIds)])];
  if (evidenceIds.length === 0) return [];

  const text = insights.flatMap((insight) => [insight.summary, insight.nextSupportSuggestion, ...insight.highlights]).join("\n");
  const candidates: SystemSoftTaskCandidate[] = [];

  if (text.includes("冻结") || text.toLowerCase().includes("freeze")) {
    candidates.push(buildCandidate("recovery", "recovery-task", "复习刚才冻结过的卡片上下文", "先恢复上下文，再继续推进会更稳。", evidenceIds));
  }

  if (text.includes("燃烧") || text.toLowerCase().includes("burn")) {
    candidates.push(
      buildCandidate(
        "continuation",
        "continuation-task",
        "检查燃烧模式完成后的后续一小步",
        "用一张轻量卡片接住刚完成的最低可行动作。",
        evidenceIds,
      ),
    );
  }

  if (text.includes("短卡")) {
    candidates.push(
      buildCandidate(
        "profile",
        "preparation-task",
        "为下一次任务准备一张短启动卡",
        "短卡更适合作为开头，先把第一步写清楚。",
        evidenceIds,
      ),
    );
  }

  if (candidates.length === 0) {
    candidates.push(
      buildCandidate(
        "proof-summary",
        "summary-reflection-task",
        "把最近完成的卡片整理成今日证据",
        "整理已确认行动，方便之后继续安排。",
        evidenceIds,
      ),
    );
  }

  return candidates;
}

function buildCandidate(
  source: SystemSoftTaskCandidate["source"],
  kind: SystemSoftTaskCandidate["kind"],
  title: string,
  reason: string,
  evidenceIds: string[],
): SystemSoftTaskCandidate {
  return {
    id: `soft_${source}_${slug(title)}_${evidenceIds[0]}`,
    source,
    kind,
    title,
    reason,
    defaultTension: "soft",
    suggestedWindow: "下一段空档",
    evidenceIds,
    requiresTimeGuardianReview: true,
  };
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

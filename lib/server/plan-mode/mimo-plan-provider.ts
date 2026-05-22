import { randomUUID } from "node:crypto";
import type { MimoChatCompletionClient } from "@/lib/server/mimo-openai-client";
import type {
  ActionCardDraft,
  PlanModeDraft,
  PlanModeProviderInput,
  PlanModeProviderOutput,
  PlanModeProviderPort,
  PlanOptionDraft,
  PlanStageDraft,
} from "@/lib/server/plan-mode/types";
import { PLAN_MODE_NO_WRITES } from "@/lib/server/plan-mode/types";

export class MimoPlanModeProvider implements PlanModeProviderPort {
  readonly provider = "mimo" as const;

  constructor(private readonly client: MimoChatCompletionClient) {}

  async generatePlanModeDraft(input: PlanModeProviderInput): Promise<PlanModeProviderOutput> {
    const config = this.client.getPublicConfig();
    const content = await this.client.createChatCompletion({
      model: config.plannerModel,
      responseFormat: "json_object",
      temperature: 0,
      maxTokens: 1800,
      messages: [
        {
          role: "system",
          content: [
            "你是 Next Card 的隐藏 Plan Mode provider。",
            "只输出 JSON，不要 markdown。",
            "必须生成 A/B/C 三个方案，每个方案至少三张可执行动作卡。",
            "禁止选择默认方案，禁止写 deck/proof/reminder/schedule。",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            requiredShape: {
              goalUnderstanding: "string",
              keyConstraints: ["string"],
              decomposition: [{ title: "string", purpose: "string" }],
              timeStrategy: ["string"],
              options: [
                {
                  title: "string",
                  objective: "string",
                  summary: "string",
                  estimatedTotalMinutes: 20,
                  riskLevel: "low | medium | high",
                  tradeoffs: ["string"],
                  cardDrafts: [
                    {
                      title: "string",
                      action: "specific next action sentence",
                      estimatedMinutes: 5,
                      objectiveLevel: "progress | standard | baseline",
                      timingIntent: "start-now | scheduled-window | before-deadline | soft-optional",
                    },
                  ],
                },
              ],
              assumptions: ["string"],
            },
            request: input.request,
          }),
        },
      ],
    });

    return { draft: normalizeMimoPlanPayload(parseJsonObject(content), input) };
  }
}

function normalizeMimoPlanPayload(payload: Record<string, unknown>, input: PlanModeProviderInput): PlanModeDraft {
  const source = (payload.draft && typeof payload.draft === "object" ? payload.draft : payload) as Record<string, unknown>;
  const stages = normalizeStages(source.decomposition, input.request.planCompilerHandoff.constraints);
  const options = normalizeOptions(source.options, stages);

  return {
    id: typeof source.id === "string" ? source.id : `draft_mimo_${randomUUID()}`,
    requestId: input.request.requestId,
    operation: input.request.operation,
    source: input.request.source,
    planCompilerHandoffId: input.request.planCompilerHandoff.id,
    verifiedInputBundleId: input.request.planCompilerHandoff.verifiedInputBundleId,
    confirmedTranscriptId: input.request.confirmedTranscriptId,
    previousPlanModeDraftId: input.request.previousPlanModeDraftId,
    status: "options-ready",
    goalUnderstanding: stringOr(source.goalUnderstanding, input.request.planCompilerHandoff.userFacingSummary),
    keyConstraints: stringArrayOr(source.keyConstraints, input.request.planCompilerHandoff.constraints),
    decomposition: stages,
    timeStrategy: stringArrayOr(source.timeStrategy, ["先完成最小启动动作", "再推进标准卡片", "最后保留 proof timeline"]),
    options,
    assumptions: stringArrayOr(source.assumptions, input.request.planCompilerHandoff.assumptions),
    missingButNonBlocking: input.request.planCompilerHandoff.missingButNonBlocking,
    provider: "mimo",
    modelRunId: `mimo_${randomUUID()}`,
    createdAt: input.createdAt,
    writes: { ...PLAN_MODE_NO_WRITES },
  };
}

function normalizeStages(value: unknown, fallbackConstraints: string[]): [PlanStageDraft, PlanStageDraft, PlanStageDraft] {
  const raw = Array.isArray(value) ? value : [];
  const defaults = ["确认目标", "执行下一步", "收口检查"];
  return [0, 1, 2].map((index) => {
    const item = raw[index] && typeof raw[index] === "object" ? (raw[index] as Record<string, unknown>) : {};
    return {
      id: `stage-${index + 1}`,
      title: stringOr(item.title, defaults[index]),
      purpose: stringOr(item.purpose, "把输入变成可执行卡片。"),
      sourceConstraintRefs: fallbackConstraints.length ? fallbackConstraints.slice(0, 3) : ["sandbox-confirmed-input"],
    };
  }) as [PlanStageDraft, PlanStageDraft, PlanStageDraft];
}

function normalizeOptions(value: unknown, stages: [PlanStageDraft, PlanStageDraft, PlanStageDraft]): [PlanOptionDraft, PlanOptionDraft, PlanOptionDraft] {
  const raw = Array.isArray(value) ? value : [];
  return [
    normalizeOption(raw[0], "plan-a", "A", "urgent", "快速保底方案", stages),
    normalizeOption(raw[1], "plan-b", "B", "balanced", "平衡推进方案", stages),
    normalizeOption(raw[2], "plan-c", "C", "gentle", "低压启动方案", stages),
  ];
}

function normalizeOption(
  value: unknown,
  id: PlanOptionDraft["id"],
  mode: PlanOptionDraft["mode"],
  style: PlanOptionDraft["style"],
  fallbackTitle: string,
  stages: [PlanStageDraft, PlanStageDraft, PlanStageDraft],
): PlanOptionDraft {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawCards = Array.isArray(item.cardDrafts) ? item.cardDrafts : [];
  const cardDrafts = [0, 1, 2].map((index) => normalizeCard(rawCards[index], id, index, stages[index].id));
  return {
    id,
    mode,
    style,
    title: stringOr(item.title, fallbackTitle),
    objective: stringOr(item.objective, "生成可执行卡组。"),
    summary: stringOr(item.summary, "把任务拆成下一步动作。"),
    estimatedTotalMinutes: positiveNumberOr(item.estimatedTotalMinutes, cardDrafts.reduce((total, card) => total + card.estimatedMinutes, 0)),
    riskLevel: riskLevelOr(item.riskLevel),
    tradeoffs: stringArrayOr(item.tradeoffs, ["沙盒测试方案，正式执行前仍需用户确认。"]),
    cardDrafts,
  };
}

function normalizeCard(value: unknown, optionId: string, index: number, sourceStageId: string): ActionCardDraft {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    id: `${optionId}-card-${index + 1}`,
    title: stringOr(item.title, `执行动作 ${index + 1}`),
    action: stringOr(item.action, "打开材料并完成一个可以检查的小动作。"),
    estimatedMinutes: positiveNumberOr(item.estimatedMinutes, 5),
    objectiveLevel: objectiveLevelOr(item.objectiveLevel),
    timingIntent: timingIntentOr(item.timingIntent),
    sourceStageId,
  };
}

function parseJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("MiMo plan response must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArrayOr(value: unknown, fallback: string[]): string[] {
  const items = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
  return items.length ? items : fallback;
}

function positiveNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function riskLevelOr(value: unknown): PlanOptionDraft["riskLevel"] {
  return value === "low" || value === "medium" || value === "high" ? value : "low";
}

function objectiveLevelOr(value: unknown): ActionCardDraft["objectiveLevel"] {
  return value === "progress" || value === "standard" || value === "baseline" ? value : "progress";
}

function timingIntentOr(value: unknown): ActionCardDraft["timingIntent"] {
  return value === "start-now" || value === "scheduled-window" || value === "before-deadline" || value === "soft-optional" ? value : "start-now";
}

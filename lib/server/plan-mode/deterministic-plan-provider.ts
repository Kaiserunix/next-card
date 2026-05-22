import { createHash } from "node:crypto";
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

type ScenarioKind = "course" | "assignment" | "study";

export class DeterministicPlanModeProvider implements PlanModeProviderPort {
  readonly provider = "deterministic-local" as const;

  async generatePlanModeDraft(input: PlanModeProviderInput): Promise<PlanModeProviderOutput> {
    const { request, createdAt } = input;
    const scenario = detectScenario(request.planCompilerHandoff.userFacingSummary);
    const stages = buildStages(request.planCompilerHandoff.constraints);
    const options = buildOptions(scenario, stages);
    const draft: PlanModeDraft = {
      id: stableDraftId(input),
      requestId: request.requestId,
      operation: request.operation,
      source: request.source,
      planCompilerHandoffId: request.planCompilerHandoff.id,
      verifiedInputBundleId: request.planCompilerHandoff.verifiedInputBundleId,
      confirmedTranscriptId: request.confirmedTranscriptId,
      previousPlanModeDraftId: request.previousPlanModeDraftId,
      status: "options-ready",
      goalUnderstanding: buildUnderstanding(request.planCompilerHandoff.userFacingSummary, request.regenerateHint),
      keyConstraints: request.planCompilerHandoff.constraints.length
        ? request.planCompilerHandoff.constraints
        : ["用户已确认输入事实，需要先生成 A/B/C 执行草案。"],
      decomposition: stages,
      timeStrategy: buildTimeStrategy(scenario, request.regenerateHint),
      options,
      assumptions: request.planCompilerHandoff.assumptions,
      missingButNonBlocking: request.planCompilerHandoff.missingButNonBlocking,
      provider: this.provider,
      createdAt,
      writes: { ...PLAN_MODE_NO_WRITES },
    };

    return { draft };
  }
}

function stableDraftId(input: PlanModeProviderInput): string {
  const { request, createdAt } = input;
  const raw = [
    request.requestId,
    request.operation,
    request.planCompilerHandoff.id,
    request.planCompilerHandoff.verifiedInputBundleId,
    request.previousPlanModeDraftId ?? "",
    request.regenerateHint ?? "",
    createdAt,
  ].join("|");
  return `draft_${createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}

function detectScenario(summary: string): ScenarioKind {
  if (/课|课程|教室|出门|早八|高数/.test(summary)) return "course";
  if (/作业|提交|作文|报告|截止|初稿/.test(summary)) return "assignment";
  return "study";
}

function buildUnderstanding(summary: string, hint: string | undefined): string {
  const suffix =
    hint === "more-gentle"
      ? "这次会把第一步压低，保留明确但不刺人的推进节奏。"
      : hint === "more-urgent"
        ? "这次会优先保住最低可完成结果。"
        : "系统会先理解目标，再拆阶段，最后给出 A/B/C 三种可选执行方案。";
  return `${summary} ${suffix}`;
}

function buildStages(constraints: string[]): [PlanStageDraft, PlanStageDraft, PlanStageDraft] {
  const refs = constraints.length ? constraints : ["已确认输入"];
  return [
    {
      id: "stage-1",
      title: "确认关键事实",
      purpose: "把目标、时间压力和当前第一步放到同一张草案里。",
      sourceConstraintRefs: refs.slice(0, 2),
    },
    {
      id: "stage-2",
      title: "完成最低推进",
      purpose: "先生成能实际执行的最小动作，避免停在大目标。",
      sourceConstraintRefs: refs.slice(0, 3),
    },
    {
      id: "stage-3",
      title: "收口与回看",
      purpose: "为后续选方案和提交 deck commit 保留清晰依据。",
      sourceConstraintRefs: refs.slice(-2),
    },
  ];
}

function buildTimeStrategy(scenario: ScenarioKind, hint: string | undefined): string[] {
  const base =
    scenario === "course"
      ? ["今晚先收拾必带材料", "把明早动作压缩成确认和出门", "缺教室等非阻塞信息稍后再补"]
      : scenario === "assignment"
        ? ["先做最低可提交版本", "再补标准质量段落", "把不确定细节放进后续检查"]
        : ["先完成一个 10 分钟内能结束的小动作", "再扩展到标准进度", "保留低压继续入口"];

  if (hint === "more-gentle") return ["先降低第一步门槛", ...base.slice(1)];
  if (hint === "more-urgent") return ["先保住最低结果", ...base.slice(0, 2)];
  if (hint === "more-detailed") return [...base, "每个阶段都保留可检查输出"];
  return base;
}

function buildOptions(
  scenario: ScenarioKind,
  stages: [PlanStageDraft, PlanStageDraft, PlanStageDraft],
): [PlanOptionDraft, PlanOptionDraft, PlanOptionDraft] {
  return [
    buildOption("plan-a", "A", "urgent", "快速保底方案", "先保住最低可执行结果。", "压缩步骤，只做最关键动作。", "medium", [
      card("card-a-1", scenarioCardTitle(scenario, "urgent", 1), scenarioAction(scenario, "urgent", 1), 5, "baseline", "start-now", stages[0].id),
      card("card-a-2", scenarioCardTitle(scenario, "urgent", 2), scenarioAction(scenario, "urgent", 2), 8, "baseline", "start-now", stages[1].id),
      card("card-a-3", scenarioCardTitle(scenario, "urgent", 3), scenarioAction(scenario, "urgent", 3), 6, "progress", "before-deadline", stages[2].id),
    ]),
    buildOption("plan-b", "B", "balanced", "标准推进方案", "用正常节奏完成可检查进度。", "兼顾速度、质量和下一步确认。", "low", [
      card("card-b-1", scenarioCardTitle(scenario, "balanced", 1), scenarioAction(scenario, "balanced", 1), 6, "baseline", "start-now", stages[0].id),
      card("card-b-2", scenarioCardTitle(scenario, "balanced", 2), scenarioAction(scenario, "balanced", 2), 12, "standard", "scheduled-window", stages[1].id),
      card("card-b-3", scenarioCardTitle(scenario, "balanced", 3), scenarioAction(scenario, "balanced", 3), 10, "standard", "before-deadline", stages[2].id),
    ]),
    buildOption("plan-c", "C", "gentle", "低压继续方案", "用很小的第一步启动，再慢慢补齐。", "压力最低，但保留后续检查。", "low", [
      card("card-c-1", scenarioCardTitle(scenario, "gentle", 1), scenarioAction(scenario, "gentle", 1), 3, "progress", "start-now", stages[0].id),
      card("card-c-2", scenarioCardTitle(scenario, "gentle", 2), scenarioAction(scenario, "gentle", 2), 7, "baseline", "start-now", stages[1].id),
      card("card-c-3", scenarioCardTitle(scenario, "gentle", 3), scenarioAction(scenario, "gentle", 3), 5, "progress", "soft-optional", stages[2].id),
    ]),
  ];
}

function buildOption(
  id: PlanOptionDraft["id"],
  mode: PlanOptionDraft["mode"],
  style: PlanOptionDraft["style"],
  title: string,
  objective: string,
  summary: string,
  riskLevel: PlanOptionDraft["riskLevel"],
  cardDrafts: ActionCardDraft[],
): PlanOptionDraft {
  return {
    id,
    mode,
    style,
    title,
    objective,
    summary,
    estimatedTotalMinutes: cardDrafts.reduce((total, item) => total + item.estimatedMinutes, 0),
    riskLevel,
    tradeoffs:
      style === "urgent"
        ? ["节省时间，但只覆盖最低推进面"]
        : style === "balanced"
          ? ["用时适中，能留下比较清楚的完成证据"]
          : ["启动压力低，但后续可能需要再补一张卡"],
    cardDrafts,
  };
}

function card(
  id: string,
  title: string,
  action: string,
  estimatedMinutes: number,
  objectiveLevel: ActionCardDraft["objectiveLevel"],
  timingIntent: ActionCardDraft["timingIntent"],
  sourceStageId: string,
): ActionCardDraft {
  return { id, title, action, estimatedMinutes, objectiveLevel, timingIntent, sourceStageId };
}

function scenarioCardTitle(scenario: ScenarioKind, style: PlanOptionDraft["style"], index: number): string {
  const map = {
    course: {
      urgent: ["圈出必带物品", "放好课本作业", "确认出门提醒"],
      balanced: ["确认课程时间", "整理上课材料", "写下明早顺序"],
      gentle: ["只拿出课本", "补齐文具作业", "明早确认教室"],
    },
    assignment: {
      urgent: ["圈出提交要求", "写最低版本", "标出提交检查"],
      balanced: ["确认评分点", "写出标准段落", "提交前检查"],
      gentle: ["只打开要求", "写一个可用句子", "留下下一步"],
    },
    study: {
      urgent: ["列出最小范围", "完成一道例题", "记录卡住点"],
      balanced: ["确认复习范围", "做一组练习", "整理错因"],
      gentle: ["打开笔记页", "圈一个关键词", "写下继续入口"],
    },
  } satisfies Record<ScenarioKind, Record<PlanOptionDraft["style"], string[]>>;

  return map[scenario][style][index - 1];
}

function scenarioAction(scenario: ScenarioKind, style: PlanOptionDraft["style"], index: number): string {
  const map = {
    course: {
      urgent: [
        "打开课程提醒，圈出高数课本、笔和上次作业这 3 个必带物品。",
        "把高数课本、笔和上次作业放到书包旁边。",
        "设置 7:40 前出门提醒，并把手机放到能听见的位置。",
      ],
      balanced: [
        "打开课程表，确认课程时间和教室信息。",
        "把课本、笔记和上次作业页整理进书包。",
        "按出门时间倒推洗漱和早餐顺序，写下明早前三步。",
      ],
      gentle: [
        "先把课程对应的课本从桌上拿出来，放到书包旁边。",
        "把一支能写的笔和上次作业页放进书包。",
        "把明早确认教室的提醒放到起床后第一条。",
      ],
    },
    assignment: {
      urgent: [
        "打开作业要求，圈出必须提交的 3 个点。",
        "用 10 分钟写出最低可提交版本的开头和结尾。",
        "在提交前检查文件名、格式和截止时间这 3 项。",
      ],
      balanced: [
        "把作业要求里的评分点抄成 3 个短句。",
        "按评分点写出一段标准正文，每点至少补一句。",
        "提交前读一遍正文，标出还欠质量的地方。",
      ],
      gentle: [
        "只打开作业要求，找到提交格式这一行。",
        "先写一个能放进正文的句子。",
        "在文档末尾写下下一步要补的两点。",
      ],
    },
    study: {
      urgent: [
        "把今天必须复习的范围写成 3 个关键词。",
        "从第一个关键词里挑一道例题，按答案旁边重做一遍。",
        "把不会的步骤标出来，写一句卡住原因。",
      ],
      balanced: [
        "打开笔记目录，确认今天要覆盖的两个小节。",
        "每个小节各做一道练习，并把答案对照一遍。",
        "把错因整理成 3 条短记录。",
      ],
      gentle: [
        "只打开笔记到目标页，不要求立刻做题。",
        "圈出一个今天能理解的关键词。",
        "写下一句下次继续时先看的位置。",
      ],
    },
  } satisfies Record<ScenarioKind, Record<PlanOptionDraft["style"], string[]>>;

  return map[scenario][style][index - 1];
}

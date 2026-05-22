import type {
  ConfirmableFact,
  FactConfirmationRequest,
  InputExtractionResult,
  InputReadiness,
  MissingFactField,
  RawInput,
} from "@/lib/server/input-layer/types";
import { uniqueMissingFields } from "@/lib/server/input-layer/types";

export type EvaluateInputReadinessInput = {
  rawInput: RawInput;
  extraction: InputExtractionResult;
};

export function evaluateInputReadiness({ rawInput, extraction }: EvaluateInputReadinessInput): InputReadiness {
  if (extraction.reviewRequirement === "blocked") {
    return {
      gate: "retry-input",
      confidence: extraction.confidence,
      reasons: ["输入暂时无法安全解析"],
      missingFields: inferMissingFields(extraction),
      suggestedChips: [],
    };
  }

  if (extraction.reviewRequirement === "strict") {
    return {
      gate: "needs-strict-review",
      confidence: extraction.confidence,
      reasons: extraction.ambiguities.length > 0 ? extraction.ambiguities : ["需要严格核对来源证据"],
      missingFields: inferMissingFields(extraction),
      suggestedChips: [],
    };
  }

  const missingFields = inferMissingFields(extraction);
  const reasons = [...extraction.ambiguities];

  if (extraction.warnings.includes("ambiguous_reference") && !missingFields.includes("event")) {
    missingFields.push("event");
  }

  const finalMissing = uniqueMissingFields(missingFields);
  const actionableTask = extraction.candidates.tasks.some((task) => task.taskType !== "unknown");
  const hasHardTime = extraction.candidates.timeConstraints.some((time) => time.isHard);

  return {
    gate: finalMissing.length === 0 || (actionableTask && hasHardTime && !finalMissing.includes("event"))
      ? "ready-for-fact-confirmation"
      : "needs-light-clarification",
    confidence: extraction.confidence,
    reasons,
    missingFields: finalMissing,
    suggestedChips: finalMissing.map((field) => ({
      field,
      label: chipLabel(field, rawInput),
      value: "",
    })),
  };
}

export function toFactConfirmationRequest(
  rawInput: RawInput,
  extraction: InputExtractionResult,
  readiness: InputReadiness,
): FactConfirmationRequest {
  return {
    id: `confirm_${rawInput.id}`,
    rawInputId: rawInput.id,
    mode: modeFor(readiness, extraction),
    summary: buildConfirmationSummary(extraction, readiness),
    facts: buildConfirmableFacts(extraction),
    missingFields: readiness.missingFields,
    riskReasons: extraction.warnings,
    canProceedToPlanMode: false,
  };
}

function modeFor(readiness: InputReadiness, extraction: InputExtractionResult): FactConfirmationRequest["mode"] {
  if (readiness.gate === "retry-input") return "blocked";
  if (readiness.gate === "needs-strict-review") return extraction.warnings.includes("multiple_goals") ? "rough-scope" : "strict-review";
  return "light-card";
}

function inferMissingFields(extraction: InputExtractionResult): MissingFactField[] {
  const missing: MissingFactField[] = [];
  if (extraction.candidates.tasks.length === 0 || extraction.warnings.includes("ambiguous_reference")) missing.push("event");
  if (extraction.candidates.timeConstraints.length === 0) missing.push("time");
  if (
    extraction.candidates.tasks.some((task) => task.taskType === "course-arrival") &&
    extraction.candidates.locations.length === 0
  ) {
    missing.push("location");
  }
  if (extraction.candidates.tasks.every((task) => task.taskType === "unknown")) missing.push("taskType");

  return uniqueMissingFields(missing);
}

function chipLabel(field: MissingFactField, rawInput: RawInput): string {
  const prefix = rawInput.sourceType === "manual-dictation" ? "补充" : "确认";
  const labels: Record<MissingFactField, string> = {
    event: `${prefix}具体任务`,
    time: `${prefix}时间`,
    deadline: `${prefix}截止`,
    location: `${prefix}地点`,
    taskType: `${prefix}类型`,
    lifecycle: `${prefix}是否固定重复`,
  };

  return labels[field];
}

function buildConfirmableFacts(extraction: InputExtractionResult): ConfirmableFact[] {
  const taskFacts: ConfirmableFact[] = extraction.candidates.tasks.map((task) => ({
    id: `fact_${task.id}`,
    field: "event",
    label: "事件",
    value: task.title,
    confidence: task.confidence,
    evidenceRefs: extraction.evidence,
  }));

  const timeFacts: ConfirmableFact[] = extraction.candidates.timeConstraints.map((time) => ({
    id: `fact_${time.id}`,
    field: time.kind === "deadline" ? "deadline" : "time",
    label: time.kind === "deadline" ? "截止" : "时间",
    value: time.label,
    confidence: time.confidence,
    evidenceRefs: extraction.evidence,
  }));

  const locationFacts: ConfirmableFact[] = extraction.candidates.locations.map((location) => ({
    id: `fact_${location.id}`,
    field: "location",
    label: "地点",
    value: location.name,
    confidence: location.confidence,
    evidenceRefs: extraction.evidence,
  }));

  return [...taskFacts, ...timeFacts, ...locationFacts];
}

function buildConfirmationSummary(extraction: InputExtractionResult, readiness: InputReadiness): string {
  const taskTitle = extraction.candidates.tasks.map((task) => task.title).join("、") || "待确认任务";
  const timeLabel = extraction.candidates.timeConstraints.map((time) => time.label).join("、") || "时间待补";
  const risk = readiness.gate === "needs-strict-review" ? "，需要核对来源证据" : "";
  return `我理解为：${taskTitle}；时间：${timeLabel}${risk}。`;
}

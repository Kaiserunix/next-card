import { randomUUID } from "node:crypto";
import { createPlanCompilerHandoff } from "@/lib/server/input-layer/plan-handoff-service";
import type {
  ConfirmableFact,
  ConfirmedLocationFact,
  ConfirmedTaskFact,
  ConfirmedTimeFact,
  FactConfirmationRequest,
  MissingFactField,
  PlanCompilerHandoff,
  TaskCandidate,
  TaskLifecycle,
  VerifiedInputBundle,
} from "@/lib/server/input-layer/types";

export type ConfirmFactsCommand = {
  request: FactConfirmationRequest;
  action: "confirm" | "correct" | "reject";
  corrections?: Partial<Record<"event" | "time" | "deadline" | "location" | "taskType" | "lifecycle", string>>;
  sourceType?: VerifiedInputBundle["sourceType"];
};

export type ConfirmFactsResult = {
  verifiedInputBundle?: VerifiedInputBundle;
  planCompilerHandoff?: PlanCompilerHandoff;
  nextAction: "send-to-plan-compiler" | "ask-light-clarification" | "show-strict-review" | "retry-input";
};

export function confirmFacts(command: ConfirmFactsCommand): ConfirmFactsResult {
  if (command.action === "reject" || command.request.mode === "blocked") {
    return { nextAction: "retry-input" };
  }

  if (command.request.mode === "rough-scope" || command.request.mode === "strict-review") {
    return { nextAction: "show-strict-review" };
  }

  const bundle = buildVerifiedBundle(command);

  if (!bundle.readyForPlanCompiler) {
    return {
      verifiedInputBundle: bundle,
      nextAction: "ask-light-clarification",
    };
  }

  return {
    verifiedInputBundle: bundle,
    planCompilerHandoff: createPlanCompilerHandoff(bundle),
    nextAction: "send-to-plan-compiler",
  };
}

function buildVerifiedBundle(command: ConfirmFactsCommand): VerifiedInputBundle {
  const corrected = command.action === "correct";
  const taskFacts = buildTaskFacts(command.request.facts, command.corrections);
  const timeFacts = buildTimeFacts(command.request.facts, command.corrections);
  const locationFacts = buildLocationFacts(command.request.facts, command.corrections);
  const lifecycle = inferLifecycle(command.request.facts, command.corrections);
  const missingButNonBlocking = command.request.missingFields.filter(isNonBlockingMissing);
  const readyForPlanCompiler = taskFacts.length > 0 && !command.request.missingFields.includes("event");

  return {
    id: `bundle_${randomUUID()}`,
    rawInputId: command.request.rawInputId,
    sourceType: command.sourceType ?? "text",
    verifiedTaskFacts: taskFacts,
    verifiedTimeFacts: timeFacts,
    verifiedLocationFacts: locationFacts,
    lifecycle,
    tensionLevel: inferTension(timeFacts),
    confirmationStatus: corrected ? "corrected" : missingButNonBlocking.length > 0 ? "partially-confirmed" : "confirmed",
    evidenceRefs: command.request.facts.flatMap((fact) => fact.evidenceRefs),
    readyForPlanCompiler,
    missingButNonBlocking,
  };
}

function buildTaskFacts(
  facts: ConfirmableFact[],
  corrections: ConfirmFactsCommand["corrections"],
): ConfirmedTaskFact[] {
  const eventFact = facts.find((fact) => fact.field === "event");
  if (!eventFact && !corrections?.event) return [];

  return [
    {
      id: "verified_task_1",
      title: corrections?.event ?? eventFact?.value ?? "待确认任务",
      taskType: inferTaskType(facts, corrections),
      confidence: eventFact?.confidence ?? 1,
    },
  ];
}

function buildTimeFacts(
  facts: ConfirmableFact[],
  corrections: ConfirmFactsCommand["corrections"],
): ConfirmedTimeFact[] {
  const timeLikeFacts = facts.filter((fact) => fact.field === "time" || fact.field === "deadline");
  const correctedDeadline = corrections?.deadline;
  const correctedTime = corrections?.time;

  if (correctedDeadline) {
    const original = timeLikeFacts.find((fact) => fact.field === "deadline");
    return [
      {
        id: "verified_time_1",
        kind: "deadline",
        label: correctedDeadline,
        isHard: true,
        confidence: 1,
        correctedFrom: original?.value,
      },
    ];
  }

  if (correctedTime) {
    const original = timeLikeFacts.find((fact) => fact.field === "time");
    return [
      {
        id: "verified_time_1",
        kind: "hard-lock",
        label: correctedTime,
        isHard: true,
        confidence: 1,
        correctedFrom: original?.value,
      },
    ];
  }

  return timeLikeFacts.map((fact, index) => ({
    id: `verified_time_${index + 1}`,
    kind: fact.field === "deadline" ? "deadline" : "hard-lock",
    label: fact.value,
    isHard: true,
    confidence: fact.confidence,
  }));
}

function buildLocationFacts(
  facts: ConfirmableFact[],
  corrections: ConfirmFactsCommand["corrections"],
): ConfirmedLocationFact[] {
  const locationFact = facts.find((fact) => fact.field === "location");
  if (!locationFact && !corrections?.location) return [];

  return [
    {
      id: "verified_location_1",
      name: corrections?.location ?? locationFact?.value ?? "",
      confidence: corrections?.location ? 1 : locationFact?.confidence ?? 0,
      correctedFrom: corrections?.location ? locationFact?.value : undefined,
    },
  ];
}

function inferTaskType(
  facts: ConfirmableFact[],
  corrections: ConfirmFactsCommand["corrections"],
): TaskCandidate["taskType"] {
  const taskTypeValue = corrections?.taskType ?? facts.find((fact) => fact.field === "taskType")?.value;
  if (isTaskType(taskTypeValue)) return taskTypeValue;

  const eventValue = corrections?.event ?? facts.find((fact) => fact.field === "event")?.value ?? "";
  if (/高数|上课|课/.test(eventValue)) return "course-arrival";
  if (/作业|作文|提交|交/.test(eventValue)) return "assignment";
  return "unknown";
}

function isTaskType(value: string | undefined): value is TaskCandidate["taskType"] {
  return value === "course-arrival" || value === "assignment" || value === "errand" || value === "study" || value === "reminder" || value === "unknown";
}

function inferLifecycle(
  facts: ConfirmableFact[],
  corrections: ConfirmFactsCommand["corrections"],
): TaskLifecycle {
  const value = corrections?.lifecycle ?? facts.find((fact) => fact.field === "lifecycle")?.value;
  if (value === "one-off" || value === "fixed-recurring") return value;
  return "unknown";
}

function inferTension(timeFacts: ConfirmedTimeFact[]): VerifiedInputBundle["tensionLevel"] {
  if (timeFacts.some((fact) => fact.kind === "deadline" && fact.isHard)) return "hard";
  if (timeFacts.some((fact) => fact.kind === "hard-lock" && fact.isHard)) return "hard";
  return "unknown";
}

function isNonBlockingMissing(field: MissingFactField): boolean {
  return field === "location" || field === "lifecycle";
}

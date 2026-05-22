import type {
  EvidenceRef,
  InputExtractionResult,
  InputWarning,
  LocationCandidate,
  RawInput,
  TaskCandidate,
  TimeCandidate,
} from "@/lib/server/input-layer/types";
import { uniqueWarnings } from "@/lib/server/input-layer/types";

export class MimoExtractionSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MimoExtractionSchemaError";
  }
}

type MimoExtractionPayload = {
  sourceKind: string;
  extractedEvents: MimoEvent[];
  extractedTimes: MimoTime[];
  extractedLocations: MimoLocation[];
  warnings: string[];
  needsStrictReview: boolean;
};

type MimoEvent = {
  title?: unknown;
  day?: unknown;
  time?: unknown;
  location?: unknown;
  confidence?: unknown;
  evidence?: unknown;
};

type MimoTime = {
  label?: unknown;
  kind?: unknown;
  confidence?: unknown;
  evidence?: unknown;
};

type MimoLocation = {
  name?: unknown;
  confidence?: unknown;
  evidence?: unknown;
};

const FORBIDDEN_KEYS = new Set([
  "selectedPlan",
  "committedDeck",
  "cardState",
  "reminderJob",
  "proofRecord",
  "profileSnapshot",
]);

export function parseAndValidateMimoExtraction(
  content: string,
  rawInput: RawInput,
  modelRunId?: string,
): InputExtractionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonContent(content));
  } catch {
    throw new MimoExtractionSchemaError("MiMo extraction response was not valid JSON.");
  }

  assertNoForbiddenKeys(parsed);
  const payload = assertPayload(parsed);
  return toInputExtractionResult(payload, rawInput, modelRunId);
}

function toInputExtractionResult(
  payload: MimoExtractionPayload,
  rawInput: RawInput,
  modelRunId?: string,
): InputExtractionResult {
  const tasks: TaskCandidate[] = [];
  const timeConstraints: TimeCandidate[] = [];
  const locations: LocationCandidate[] = [];
  const courses: InputExtractionResult["candidates"]["courses"] = [];
  const evidence: EvidenceRef[] = [];
  const warnings: InputWarning[] = [
    "high_risk_multimodal",
    ...payload.warnings.map(toInputWarning).filter((warning): warning is InputWarning => Boolean(warning)),
  ];
  const seenTimes = new Set<string>();
  const seenLocations = new Set<string>();
  const seenCourses = new Set<string>();

  payload.extractedEvents.forEach((event, index) => {
    const title = readString(event.title) ?? "未命名事件";
    const timeLabel = formatEventTime(event);
    const confidence = readConfidence(event.confidence, 0.74);
    const quote = eventEvidenceQuote(event, title, timeLabel);
    const eventEvidence = buildEvidence(rawInput, event.evidence, quote, confidence);
    evidence.push(eventEvidence);

    if (isCourseSchedule(payload.sourceKind, title)) {
      const courseName = normalizeCourseName(title);
      tasks.push({
        id: `task_course_${index + 1}`,
        title: `去${courseName}课`,
        taskType: "course-arrival",
        confidence,
        lifecycle: "fixed-recurring",
      });
      if (!seenCourses.has(courseName)) {
        courses.push({ id: `course_${courses.length + 1}`, courseName, confidence });
        seenCourses.add(courseName);
      }
      warnings.push("course_time", "table_parse_result");
    } else if (title !== "未命名事件") {
      tasks.push({
        id: `task_event_${index + 1}`,
        title,
        taskType: /作业|提交|报告|作文|论文/.test(title) ? "assignment" : "unknown",
        confidence,
        lifecycle: "unknown",
      });
    }

    if (timeLabel) {
      addTimeCandidate(timeConstraints, seenTimes, {
        id: `time_event_${index + 1}`,
        kind: "hard-lock",
        label: timeLabel,
        isHard: true,
        confidence,
      });
    }

    const location = readString(event.location);
    if (location && !seenLocations.has(location)) {
      locations.push({ id: `location_event_${locations.length + 1}`, name: location, confidence });
      seenLocations.add(location);
    }
  });

  payload.extractedTimes.forEach((time, index) => {
    const label = readString(time.label);
    if (!label) return;
    const kind = normalizeTimeKind(readString(time.kind));
    const confidence = readConfidence(time.confidence, 0.72);
    addTimeCandidate(timeConstraints, seenTimes, {
      id: `time_extracted_${index + 1}`,
      kind,
      label,
      isHard: kind === "deadline" || kind === "hard-lock",
      confidence,
    });
    evidence.push(buildEvidence(rawInput, time.evidence, label, confidence));
    if (kind === "deadline") warnings.push("submission_deadline");
    if (kind === "hard-lock") warnings.push("course_time");
  });

  payload.extractedLocations.forEach((location, index) => {
    const name = readString(location.name);
    if (!name || seenLocations.has(name)) return;
    const confidence = readConfidence(location.confidence, 0.72);
    locations.push({ id: `location_extracted_${index + 1}`, name, confidence });
    seenLocations.add(name);
    evidence.push(buildEvidence(rawInput, location.evidence, name, confidence));
  });

  if (evidence.some((item) => /ignore previous instructions|delete reminders|mark complete|忽略.*指令|标成完成/i.test(item.quote ?? ""))) {
    warnings.push("prompt_injection_like_text");
  }

  const confidence = meanConfidence([
    ...tasks.map((item) => item.confidence),
    ...timeConstraints.map((item) => item.confidence),
    ...locations.map((item) => item.confidence),
  ]);

  return {
    id: `extract_${rawInput.id}`,
    rawInputId: rawInput.id,
    modelRunId,
    candidates: {
      tasks,
      timeConstraints,
      locations,
      courses,
      reminders: [],
    },
    confidence,
    ambiguities: [],
    warnings: uniqueWarnings(warnings),
    evidence: dedupeEvidence(evidence),
    reviewRequirement: payload.needsStrictReview ? "strict" : "light",
  };
}

function assertPayload(value: unknown): MimoExtractionPayload {
  if (!isRecord(value)) throw new MimoExtractionSchemaError("MiMo extraction response must be an object.");
  if (typeof value.needsStrictReview !== "boolean") {
    throw new MimoExtractionSchemaError("MiMo extraction response must include needsStrictReview.");
  }
  if (!Array.isArray(value.extractedEvents)) {
    throw new MimoExtractionSchemaError("MiMo extraction response must include extractedEvents array.");
  }
  if (!Array.isArray(value.extractedTimes)) {
    throw new MimoExtractionSchemaError("MiMo extraction response must include extractedTimes array.");
  }
  if (!Array.isArray(value.extractedLocations)) {
    throw new MimoExtractionSchemaError("MiMo extraction response must include extractedLocations array.");
  }
  if (!Array.isArray(value.warnings)) {
    throw new MimoExtractionSchemaError("MiMo extraction response must include warnings array.");
  }

  return {
    sourceKind: readString(value.sourceKind) ?? "unknown",
    extractedEvents: value.extractedEvents.filter(isRecord),
    extractedTimes: value.extractedTimes.filter(isRecord),
    extractedLocations: value.extractedLocations.filter(isRecord),
    warnings: value.warnings.filter((warning): warning is string => typeof warning === "string"),
    needsStrictReview: value.needsStrictReview,
  };
}

function assertNoForbiddenKeys(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenKeys);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new MimoExtractionSchemaError(`MiMo extraction response included forbidden output key: ${key}.`);
    }
    assertNoForbiddenKeys(child);
  }
}

function formatEventTime(event: MimoEvent): string | undefined {
  const day = readString(event.day);
  const time = readString(event.time);
  if (day && time) return `${day} ${time}`;
  return time ?? day;
}

function eventEvidenceQuote(event: MimoEvent, title: string, timeLabel: string | undefined): string {
  const evidence = isRecord(event.evidence) ? readString(event.evidence.quote) : undefined;
  if (evidence) return evidence;
  return [timeLabel, title, readString(event.location)].filter(Boolean).join(" ");
}

function buildEvidence(rawInput: RawInput, rawEvidence: unknown, fallbackQuote: string, fallbackConfidence: number): EvidenceRef {
  const record = isRecord(rawEvidence) ? rawEvidence : {};
  return {
    rawInputId: rawInput.id,
    quote: readString(record.quote) ?? fallbackQuote,
    boundingBox: readBoundingBox(record.boundingBox),
    textSpan: readTextSpan(record.textSpan),
    page: readNumber(record.page),
    confidence: readConfidence(record.confidence, fallbackConfidence),
  };
}

function readBoundingBox(value: unknown): EvidenceRef["boundingBox"] {
  if (!isRecord(value)) return undefined;
  const x = readNumber(value.x);
  const y = readNumber(value.y);
  const width = readNumber(value.width);
  const height = readNumber(value.height);
  if ([x, y, width, height].some((item) => item === undefined)) return undefined;
  return { x: x!, y: y!, width: width!, height: height! };
}

function readTextSpan(value: unknown): EvidenceRef["textSpan"] {
  if (!isRecord(value)) return undefined;
  const start = readNumber(value.start);
  const end = readNumber(value.end);
  if (start === undefined || end === undefined) return undefined;
  return { start, end };
}

function addTimeCandidate(candidates: TimeCandidate[], seen: Set<string>, candidate: TimeCandidate): void {
  if (seen.has(candidate.label)) return;
  candidates.push(candidate);
  seen.add(candidate.label);
}

function normalizeTimeKind(value: string | undefined): TimeCandidate["kind"] {
  if (value === "deadline" || value === "hard-lock" || value === "soft-window" || value === "start-window" || value === "reminder-window") {
    return value;
  }
  return "hard-lock";
}

function normalizeCourseName(title: string): string {
  return title.replace(/课程|课$/g, "") || title;
}

function isCourseSchedule(sourceKind: string, title: string): boolean {
  return sourceKind === "courseSchedule" || /高数|数学|英语|课程|课$/.test(title);
}

function toInputWarning(value: string): InputWarning | undefined {
  const normalized = value.trim();
  const known: InputWarning[] = [
    "ambiguous_reference",
    "relative_date",
    "missing_timezone",
    "conflicting_deadline",
    "low_confidence_time",
    "table_parse_result",
    "course_time",
    "exam_time",
    "submission_deadline",
    "prompt_injection_like_text",
    "high_risk_multimodal",
    "hard_time_without_evidence",
    "location_affects_arrival",
    "lifecycle_ambiguous",
    "multiple_goals",
    "insufficient_input",
  ];
  if (known.includes(normalized as InputWarning)) return normalized as InputWarning;
  if (/prompt|ignore|instruction/i.test(normalized)) return "prompt_injection_like_text";
  if (/low.*confidence|低置信/i.test(normalized)) return "low_confidence_time";
  return undefined;
}

function dedupeEvidence(evidence: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.quote ?? ""}:${item.confidence}`;
    if (!item.quote || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function meanConfidence(values: number[]): number {
  if (values.length === 0) return 0.34;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readConfidence(value: unknown, fallback: number): number {
  const parsed = readNumber(value);
  if (parsed === undefined) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractJsonContent(content: string): string {
  const trimmed = content.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);

  return trimmed;
}

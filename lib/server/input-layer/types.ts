export type RawInputSourceType =
  | "voice"
  | "manual-dictation"
  | "text"
  | "image"
  | "pdf"
  | "docx"
  | "notification"
  | "mixed";

export type InputLocale = "zh-CN" | "en" | "mixed" | "auto";

export type PrivacyFlag =
  | "contains_third_party_info"
  | "contains_student_id"
  | "contains_grade_info"
  | "contains_location"
  | "unknown";

export type RawInput = {
  id: string;
  userId?: string;
  anonymousDeviceId?: string;
  sourceType: RawInputSourceType;
  contentRef?: string;
  text?: string;
  transcriptId?: string;
  sourceHash: string;
  locale: InputLocale;
  timezone?: string;
  createdAt: string;
  receivedAt: string;
  privacyFlags: PrivacyFlag[];
  retentionPolicy: {
    rawRetentionDays: number;
    derivedRetentionDays: number;
    userDeletable: boolean;
  };
};

export type EvidenceRef = {
  rawInputId: string;
  page?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  textSpan?: {
    start: number;
    end: number;
  };
  quote?: string;
  confidence: number;
};

export type TaskLifecycle = "one-off" | "fixed-recurring" | "unknown";

export type TaskCandidate = {
  id: string;
  title: string;
  taskType: "course-arrival" | "assignment" | "errand" | "study" | "reminder" | "unknown";
  confidence: number;
  lifecycle: TaskLifecycle;
};

export type TimeCandidate = {
  id: string;
  kind: "deadline" | "hard-lock" | "soft-window" | "start-window" | "reminder-window";
  label: string;
  normalizedAt?: string;
  isHard: boolean;
  confidence: number;
};

export type LocationCandidate = {
  id: string;
  name: string;
  confidence: number;
};

export type CourseCandidate = {
  id: string;
  courseName: string;
  confidence: number;
};

export type ReminderIntentCandidate = {
  id: string;
  label: string;
  confidence: number;
};

export type InputWarning =
  | "ambiguous_reference"
  | "relative_date"
  | "missing_timezone"
  | "conflicting_deadline"
  | "low_confidence_time"
  | "table_parse_result"
  | "course_time"
  | "exam_time"
  | "submission_deadline"
  | "prompt_injection_like_text"
  | "high_risk_multimodal"
  | "hard_time_without_evidence"
  | "location_affects_arrival"
  | "lifecycle_ambiguous"
  | "multiple_goals"
  | "insufficient_input";

export type ReviewRequirement = "none" | "light" | "strict" | "blocked";

export type InputExtractionResult = {
  id: string;
  rawInputId: string;
  modelRunId?: string;
  candidates: {
    tasks: TaskCandidate[];
    timeConstraints: TimeCandidate[];
    locations: LocationCandidate[];
    courses: CourseCandidate[];
    reminders: ReminderIntentCandidate[];
  };
  confidence: number;
  ambiguities: string[];
  warnings: InputWarning[];
  evidence: EvidenceRef[];
  reviewRequirement: ReviewRequirement;
};

export type ConfirmableFactField = "event" | "time" | "deadline" | "location" | "taskType" | "lifecycle" | "scope";

export type ConfirmableFact = {
  id: string;
  field: ConfirmableFactField;
  label: string;
  value: string;
  confidence: number;
  evidenceRefs: EvidenceRef[];
};

export type MissingFactField = "event" | "time" | "deadline" | "location" | "taskType" | "lifecycle";

export type FactConfirmationRequest = {
  id: string;
  rawInputId: string;
  mode: "light-card" | "rough-scope" | "strict-review" | "blocked";
  summary: string;
  facts: ConfirmableFact[];
  missingFields: MissingFactField[];
  riskReasons: InputWarning[];
  canProceedToPlanMode: boolean;
};

export type ConfirmedTaskFact = {
  id: string;
  title: string;
  taskType: TaskCandidate["taskType"];
  confidence: number;
};

export type ConfirmedTimeFact = {
  id: string;
  kind: TimeCandidate["kind"];
  label: string;
  normalizedAt?: string;
  isHard: boolean;
  confidence: number;
  correctedFrom?: string;
};

export type ConfirmedLocationFact = {
  id: string;
  name: string;
  confidence: number;
  correctedFrom?: string;
};

export type VerifiedInputBundle = {
  id: string;
  rawInputId: string;
  sourceType?: RawInputSourceType;
  verifiedTaskFacts: ConfirmedTaskFact[];
  verifiedTimeFacts: ConfirmedTimeFact[];
  verifiedLocationFacts: ConfirmedLocationFact[];
  lifecycle: TaskLifecycle;
  tensionLevel: "hard" | "deadline-sensitive" | "recommended" | "soft" | "unknown";
  confirmationStatus: "confirmed" | "corrected" | "partially-confirmed";
  evidenceRefs: EvidenceRef[];
  readyForPlanCompiler: boolean;
  missingButNonBlocking?: MissingFactField[];
};

export type PlanCompilerHandoff = {
  id: string;
  verifiedInputBundleId: string;
  userFacingSummary: string;
  constraints: string[];
  assumptions: string[];
  missingButNonBlocking: string[];
  sourceType: RawInputSourceType;
  mustGenerateABC: true;
};

export type InputReadiness = {
  gate: "ready-for-fact-confirmation" | "needs-light-clarification" | "needs-strict-review" | "retry-input";
  confidence: number;
  reasons: string[];
  missingFields: MissingFactField[];
  suggestedChips: Array<{
    field: MissingFactField;
    label: string;
    value: string;
  }>;
};

export function uniqueWarnings(warnings: InputWarning[]): InputWarning[] {
  return [...new Set(warnings)];
}

export function uniqueMissingFields(fields: MissingFactField[]): MissingFactField[] {
  return [...new Set(fields)];
}

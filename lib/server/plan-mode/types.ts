import type { InputLocale, PlanCompilerHandoff } from "@/lib/server/input-layer/types";

export type PlanModeSource =
  | "voice-confirmed"
  | "manual-dictation"
  | "text-confirmed"
  | "multimodal-confirmed";

export type PlanModeOperation = "generate" | "regenerate";

export type PlanModeRegenerateHint = "try-again" | "more-urgent" | "more-gentle" | "more-detailed";

export type PlanModeProviderName = "deterministic-local" | "mimo" | "openai-compatible" | "unknown";

export type PlanModeClientContext = {
  now: string;
  timezone: string;
  locale: InputLocale;
};

export type PlanModeRequest = {
  requestId: string;
  anonymousDeviceId?: string;
  userId?: string;
  operation: PlanModeOperation;
  source: PlanModeSource;
  planCompilerHandoff: PlanCompilerHandoff;
  confirmedTranscriptId?: string;
  previousPlanModeDraftId?: string;
  regenerateHint?: PlanModeRegenerateHint;
  clientContext: PlanModeClientContext;
};

export type PlanModeWrites = {
  deckCommitted: false;
  proofWritten: false;
  remindersCreated: false;
  scheduleQueued: false;
};

export type PlanStageDraft = {
  id: string;
  title: string;
  purpose: string;
  sourceConstraintRefs: string[];
};

export type ActionCardDraft = {
  id: string;
  title: string;
  action: string;
  estimatedMinutes: number;
  objectiveLevel: "progress" | "standard" | "baseline";
  timingIntent: "start-now" | "scheduled-window" | "before-deadline" | "soft-optional";
  sourceStageId: string;
};

export type PlanOptionDraft = {
  id: "plan-a" | "plan-b" | "plan-c";
  mode: "A" | "B" | "C";
  style: "urgent" | "balanced" | "gentle";
  title: string;
  objective: string;
  summary: string;
  estimatedTotalMinutes: number;
  riskLevel: "low" | "medium" | "high";
  tradeoffs: string[];
  cardDrafts: ActionCardDraft[];
};

export type PlanModeDraft = {
  id: string;
  requestId: string;
  operation: PlanModeOperation;
  source: PlanModeSource;
  planCompilerHandoffId: string;
  verifiedInputBundleId: string;
  confirmedTranscriptId?: string;
  previousPlanModeDraftId?: string;
  status: "options-ready" | "needs-more-facts" | "blocked";
  goalUnderstanding: string;
  keyConstraints: string[];
  decomposition: PlanStageDraft[];
  timeStrategy: string[];
  options: [PlanOptionDraft, PlanOptionDraft, PlanOptionDraft];
  assumptions: string[];
  missingButNonBlocking: string[];
  provider: PlanModeProviderName;
  modelRunId?: string;
  createdAt: string;
  writes: PlanModeWrites;
};

export type PlanModeResponse = {
  draft: PlanModeDraft;
};

export type PlanModeErrorResponse = {
  error: "PLAN_MODE_NOT_READY" | "INVALID_PLAN_MODE_REQUEST" | "PROVIDER_FAILED" | "PLAN_OUTPUT_INVALID";
  message: string;
  recoverable: boolean;
};

export type PlanModeProviderInput = {
  request: PlanModeRequest;
  createdAt: string;
};

export type PlanModeProviderOutput = {
  draft: PlanModeDraft;
};

export interface PlanModeProviderPort {
  readonly provider: Exclude<PlanModeProviderName, "unknown">;
  generatePlanModeDraft(input: PlanModeProviderInput): Promise<PlanModeProviderOutput>;
}

export type DeckCommitRequestStub = {
  planModeDraftId: string;
  selectedOptionId: "plan-a" | "plan-b" | "plan-c";
  userEdits?: unknown;
};

export const PLAN_MODE_NO_WRITES: PlanModeWrites = {
  deckCommitted: false,
  proofWritten: false,
  remindersCreated: false,
  scheduleQueued: false,
};

export type RhythmWindowDays = 7 | 14 | 30 | 90;

export type ProfileMode = "default" | "explicit-user-choice" | "candidate" | "active";

export type ProfileDimensionValue = "unknown" | "low" | "medium" | "high";

export type PolicyAppliesTo = "future-planning-only" | "future-reminders-only" | "experiment";

export type SystemSoftTaskSource = "profile" | "proof-summary" | "recovery" | "continuation";

export type ProofEventType =
  | "deck-created"
  | "first-card-started"
  | "card-completed"
  | "card-frozen"
  | "card-resumed"
  | "card-burning-started"
  | "card-burn-completed"
  | "card-rescheduled"
  | "deck-rewarded"
  | "summary-accepted"
  | "reminder-delivered"
  | "reminder-responded"
  | "transcript-candidate"
  | "ocr-candidate";

export type ProofEventSource =
  | "proof-ledger"
  | "card-runtime"
  | "time-guardian"
  | "reminder-audit"
  | "rejected-transcript"
  | "unconfirmed-multimodal";

export type ProofEventRef = {
  id: string;
  userId: string;
  deckId?: string;
  cardId?: string;
  type: ProofEventType;
  occurredAt: string;
  verified: boolean;
  source: ProofEventSource;
  estimatedMinutes?: number;
  actualMinutes?: number;
  chosenPlanId?: "plan-1" | "plan-2" | "plan-3";
  goalContractId?: string;
  qualityDebtIds?: string[];
};

export type ReminderAuditRef = {
  id: string;
  userId: string;
  reminderId: string;
  occurredAt: string;
  deliveryStatus: "delivered" | "responded" | "failed" | "permission-missing" | "in-app-only";
  channel: "external" | "in-app";
  permission: "granted" | "missing" | "denied" | "in-app-only";
  reliable: boolean;
  proofEventId?: string;
};

export type ProofSignalAggregate = {
  id: string;
  userId: string;
  windowDays: RhythmWindowDays;
  createdAt: string;
  evidenceEventIds: string[];
  signals: {
    firstCardStartDelayMinutes?: number;
    actualVsEstimatedRatio?: number;
    freezeRate?: number;
    burnCompletionRate?: number;
    deliveredReminderResponseRate?: number;
    recoveryAfterFreezeMedianMinutes?: number;
    shortCardCompletionRate?: number;
  };
  dataQuality: {
    evidenceCount: number;
    reminderDeliveryReliable: boolean;
    hasEnoughData: boolean;
  };
};

export type ProfileDimension = {
  value: ProfileDimensionValue;
  confidence: number;
  evidenceCount: number;
  lastUpdatedAt: string;
};

export type ProfileSnapshot = {
  id: string;
  userId: string;
  version: number;
  createdAt: string;
  evidenceWindowDays: RhythmWindowDays;
  confidence: number;
  mode: ProfileMode;
  dimensions: {
    activationSupportLevel: ProfileDimension;
    timeEstimateCalibration: ProfileDimension;
    progressRhythm: ProfileDimension;
    reminderPressureFit: ProfileDimension;
  };
  evidenceIds: string[];
  userEditable: boolean;
  resettable: boolean;
};

export type ProfilePreferencePreset =
  | "default-balanced"
  | "low-pressure-start"
  | "short-card-focus"
  | "more-buffer"
  | "light-reminders";

export type AgentPolicyAllowedInfluence =
  | "future-first-card-size"
  | "future-card-minute-range"
  | "future-buffer-size"
  | "future-reminder-tone"
  | "future-nudge-daily-cap"
  | "future-burn-sensitivity"
  | "future-freeze-recovery-style"
  | "future-optional-continuation";

export type AgentPolicyForbiddenInfluence =
  | "deadline"
  | "hard-lock"
  | "baseline-reminder-existence"
  | "chosen-plan-override"
  | "proof"
  | "baseline-goal"
  | "standard-goal"
  | "committed-deck-card-reminder";

export type AgentPolicySnapshot = {
  id: string;
  profileSnapshotId: string;
  version: number;
  createdAt: string;
  appliesTo: PolicyAppliesTo;
  planIntensity: "minimal" | "balanced" | "sprint";
  cardGranularity: "micro" | "standard" | "dense";
  cardMinuteRange: [number, number];
  bufferMultiplier: number;
  reminderStrictness: "light" | "normal" | "strong";
  nudgeDailyCap: number;
  burnSensitivity: number;
  freezeRecoveryStyle: "resume-context" | "smaller-first-card" | "ask-user";
  optionalContinuationCards: boolean;
  allowedInfluence: AgentPolicyAllowedInfluence[];
  forbiddenInfluence: AgentPolicyForbiddenInfluence[];
  explanation: string;
};

export type SystemSoftTaskCandidate = {
  id: string;
  source: SystemSoftTaskSource;
  kind: "review-task" | "recovery-task" | "preparation-task" | "continuation-task" | "summary-reflection-task";
  title: string;
  reason: string;
  defaultTension: "soft";
  suggestedWindow?: string;
  evidenceIds: string[];
  requiresTimeGuardianReview: true;
};

export type ProfileExplanation = {
  id: string;
  profileSnapshotId: string;
  policySnapshotId: string;
  createdAt: string;
  surface: "card-reason" | "proof-summary" | "settings";
  explains: Array<
    | "future-planning-hint"
    | "future-reminder-tone"
    | "future-first-step-size"
    | "future-buffer-preference"
    | "future-freeze-recovery"
  >;
  messages: string[];
};

export type ProofSummaryInsight = {
  id: string;
  aggregateId: string;
  profileSnapshotId: string;
  policySnapshotId: string;
  createdAt: string;
  summary: string;
  highlights: string[];
  nextSupportSuggestion: string;
  evidenceIds: string[];
  confidence: number;
};

export type ProfileGovernanceSettings = {
  userId: string;
  personalizationEnabled: boolean;
  autoUpdateEnabled: boolean;
  evidenceWindowDays: RhythmWindowDays;
  minimumEvidenceCount: number;
  minimumConfidence: number;
  experimentFlags: string[];
  updatedAt: string;
};

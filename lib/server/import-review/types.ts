import type { ReviewGateDecision } from "@/lib/server/input-layer/review-gate";
import type {
  InputExtractionResult,
  InputLocale,
  PlanCompilerHandoff,
  RawInputSourceType,
  FactConfirmationRequest,
  VerifiedInputBundle,
} from "@/lib/server/input-layer/types";

export type ImportReviewClientContext = {
  now?: string;
  timezone?: string;
  locale?: InputLocale;
  anonymousDeviceId?: string;
  userId?: string;
};

export type ImportReviewUpload = {
  name: string;
  type?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ImportReviewCommand = {
  sourceType: RawInputSourceType;
  text?: string;
  file?: ImportReviewUpload;
  filePath?: string;
  clientContext?: ImportReviewClientContext;
  sandboxMode?: boolean;
  confirmationAction?: "confirm" | "correct" | "reject";
  corrections?: Partial<Record<"event" | "time" | "deadline" | "location" | "taskType" | "lifecycle", string>>;
};

export type ImportReviewConfirmationSessionStatus = "pending" | "confirmed" | "corrected" | "rejected" | "expired";

export type ImportReviewConfirmationSession = {
  id: string;
  rawInputId: string;
  sourceType: RawInputSourceType;
  extraction: InputExtractionResult;
  confirmationRequest: FactConfirmationRequest;
  reviewRequirement: ImportReviewReport["reviewGate"]["requirement"];
  createdAt: string;
  expiresAt: string;
  status: ImportReviewConfirmationSessionStatus;
  closedAt?: string;
};

export type ImportConfirmationFactsCorrection = {
  factId: string;
  value: string;
};

export type ImportConfirmationCorrections = {
  facts?: ImportConfirmationFactsCorrection[];
  missingFacts?: Partial<Record<"event" | "time" | "deadline" | "location" | "taskType" | "lifecycle", string>>;
};

export type ImportConfirmationCommand = {
  reviewSessionId: string;
  action: "confirm" | "correct" | "reject";
  corrections?: ImportConfirmationCorrections;
  clientContext?: ImportReviewClientContext;
};

export type ImportConfirmationResult = {
  status: "confirmed" | "corrected" | "rejected";
  verifiedInputBundle?: VerifiedInputBundle;
  planCompilerHandoff?: PlanCompilerHandoff;
  boundaryWarnings: string[];
  errors: string[];
};

export type ImportReviewProviderUsage = {
  provider: "mimo" | "mock" | "manual" | "document-text";
  model?: string;
  used: boolean;
  recoverable?: boolean;
  reason?: string;
};

export type ImportReviewReport = {
  reportId: string;
  rawInputId: string;
  reviewSessionId?: string;
  sourceType: RawInputSourceType;
  extraction: InputExtractionResult;
  reviewGate: ReviewGateDecision;
  canProceedToPlanMode: boolean;
  planCompilerHandoff?: PlanCompilerHandoff;
  boundaryWarnings: string[];
  providerUsage: ImportReviewProviderUsage;
};

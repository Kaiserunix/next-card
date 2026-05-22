import type { ReviewGateDecision } from "@/lib/server/input-layer/review-gate";
import type {
  InputExtractionResult,
  InputLocale,
  PlanCompilerHandoff,
  RawInputSourceType,
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

export type ImportReviewProviderUsage = {
  provider: "mimo" | "mock" | "manual";
  model?: string;
  used: boolean;
};

export type ImportReviewReport = {
  reportId: string;
  rawInputId: string;
  sourceType: RawInputSourceType;
  extraction: InputExtractionResult;
  reviewGate: ReviewGateDecision;
  canProceedToPlanMode: boolean;
  planCompilerHandoff?: PlanCompilerHandoff;
  boundaryWarnings: string[];
  providerUsage: ImportReviewProviderUsage;
};

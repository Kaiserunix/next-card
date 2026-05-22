import type { ImportReviewReport } from "@/lib/server/import-review/types";
import type { RawInputSourceType } from "@/lib/server/input-layer/types";
import type { PlanModeDraft, PlanOptionDraft } from "@/lib/server/plan-mode/types";
import type { CommittedCard, CommittedDeck } from "@/lib/server/deck-commit/types";
import type { ProofEvent } from "@/lib/server/proof-ledger/types";
import type { QueueAction, TimeLock, TimeWindow } from "@/lib/server/time-guardian/types";

export type BackendSandboxRunClientContext = {
  now?: string;
  timezone?: string;
  locale?: "zh-CN" | "en" | "mixed" | "auto";
  anonymousDeviceId?: string;
  userId?: string;
};

export type BackendSandboxRunCommand = {
  sourceType: RawInputSourceType;
  text?: string;
  filePath?: string;
  selectedOptionId?: PlanOptionDraft["id"];
  autoConfirmLightReview?: boolean;
  clientContext?: BackendSandboxRunClientContext;
  availableWindows?: TimeWindow[];
  timeLocks?: TimeLock[];
};

export type BackendRunError = {
  stage: string;
  message: string;
  recoverable: boolean;
};

export type BackendRunReport = {
  reportId: string;
  sandbox: true;
  importReview: ImportReviewReport;
  planModeDraft?: PlanModeDraft;
  committedDeck?: CommittedDeck;
  committedCards?: CommittedCard[];
  timeGuardianActions: QueueAction[];
  proofTimeline: ProofEvent[];
  boundaryWarnings: string[];
  errors: BackendRunError[];
};

import type { ImportReviewReport } from "@/lib/server/import-review/types";
import type { ImportConfirmationCommand, ImportConfirmationCorrections, ImportConfirmationResult } from "@/lib/server/import-review/types";
import type { RawInputSourceType } from "@/lib/server/input-layer/types";
import type { PlanModeDraft, PlanOptionDraft } from "@/lib/server/plan-mode/types";
import type { CommittedCard, CommittedDeck } from "@/lib/server/deck-commit/types";
import type { ProofTimelineEntry } from "@/lib/server/proof-ledger/types";
import type { CardRuntimeAction, CardRuntimeActionResponse } from "@/lib/server/card-runtime/types";
import type { NotificationCapability, QueueAction, TimeLock, TimeWindow } from "@/lib/server/time-guardian/types";

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
  confirmation?: Omit<ImportConfirmationCommand, "reviewSessionId">;
  confirmedFacts?: ImportConfirmationCorrections["missingFacts"];
  cardActions?: BackendSandboxCardAction[];
  notificationCapability?: NotificationCapability;
  clientContext?: BackendSandboxRunClientContext;
  availableWindows?: TimeWindow[];
  timeLocks?: TimeLock[];
};

export type BackendSandboxCardAction = {
  requestId?: string;
  cardId?: string;
  action: CardRuntimeAction;
  actualMinutes?: number;
  reason?: string;
  deferToWindow?: TimeWindow;
  fromWindow?: TimeWindow;
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
  importConfirmation?: ImportConfirmationResult;
  planModeDraft?: PlanModeDraft;
  committedDeck?: CommittedDeck;
  committedCards?: CommittedCard[];
  cardRuntimeActions: CardRuntimeActionResponse[];
  timeGuardianActions: QueueAction[];
  proofTimeline: ProofTimelineEntry[];
  boundaryWarnings: string[];
  errors: BackendRunError[];
};

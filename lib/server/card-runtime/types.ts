import type { PlanOptionDraft } from "@/lib/server/plan-mode/types";
import type { ProofEvent } from "@/lib/server/proof-ledger/types";
import type { NotificationCapability, QueueAction, TimeLock, TimeWindow } from "@/lib/server/time-guardian/types";

export type CardRuntimeAction =
  | "start"
  | "complete"
  | "freeze"
  | "burn_start"
  | "burn_complete"
  | "defer"
  | "resume";

export type CardRuntimeStatus = "queued" | "active" | "burning" | "completed" | "frozen" | "deferred";

export type CardRuntimeClientContext = {
  now?: string;
  timezone?: string;
  anonymousDeviceId?: string;
  userId?: string;
};

export type CardRuntimeActionRequest = {
  requestId: string;
  deckId: string;
  cardId: string;
  action: CardRuntimeAction;
  actualMinutes?: number;
  reason?: string;
  deferToWindow?: TimeWindow;
  fromWindow?: TimeWindow;
  timeLocks?: TimeLock[];
  availableWindows?: TimeWindow[];
  notificationCapability?: NotificationCapability;
  clientContext?: CardRuntimeClientContext;
};

export type CardRuntimeState = {
  deckId: string;
  cardId: string;
  selectedOptionId: PlanOptionDraft["id"];
  status: CardRuntimeStatus;
  startedAt?: string;
  completedAt?: string;
  frozenAt?: string;
  burnStartedAt?: string;
  burnCompletedAt?: string;
  deferredAt?: string;
  resumedAt?: string;
  actualMinutes: number;
  elapsedSeconds: number;
  lastAction: CardRuntimeAction | "created";
  lastActionAt: string;
  updatedAt: string;
};

export type CardRuntimeEvent = {
  id: string;
  requestId: string;
  deckId: string;
  cardId: string;
  action: CardRuntimeAction;
  createdAt: string;
  stateStatus: CardRuntimeStatus;
  proofEventIds: string[];
  timeGuardianActions: QueueAction[];
  rejected?: boolean;
  rejectionReason?: string;
};

export type CardRuntimeActionResponse = {
  cardRuntimeState: CardRuntimeState;
  proofEvents: ProofEvent[];
  timeGuardianActions: QueueAction[];
  boundaryWarnings: string[];
};

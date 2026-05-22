import type { PlanOptionDraft } from "@/lib/server/plan-mode/types";
import type { ProofEvent, ProofOutboxRecord } from "@/lib/server/proof-ledger/types";
import type { TaskTension } from "@/lib/server/time-guardian/types";

export type DeckCommitClientContext = {
  now?: string;
  timezone?: string;
};

export type DeckCommitRequest = {
  requestId: string;
  planModeDraftId: string;
  selectedOptionId: PlanOptionDraft["id"];
  anonymousDeviceId?: string;
  userId?: string;
  clientContext?: DeckCommitClientContext;
};

export type CommittedDeck = {
  deckId: string;
  planModeDraftId: string;
  planCompilerHandoffId: string;
  verifiedInputBundleId: string;
  selectedOptionId: PlanOptionDraft["id"];
  title: string;
  summary: string;
  source: string;
  status: "committed";
  totalCards: number;
  createdAt: string;
  userId?: string;
  anonymousDeviceId?: string;
};

export type CommittedCard = {
  cardId: string;
  deckId: string;
  planModeDraftId: string;
  selectedOptionId: PlanOptionDraft["id"];
  sourceCardDraftId: string;
  sourceStageId: string;
  title: string;
  action: string;
  estimatedMinutes: number;
  objectiveLevel: "progress" | "standard" | "baseline";
  timingIntent: "start-now" | "scheduled-window" | "before-deadline" | "soft-optional";
  tension: TaskTension;
  hardLockRefs: string[];
  deadlineAt?: string;
  preferredStartAt?: string;
  status: "queued";
  sequence: number;
  createdAt: string;
};

export type DeckCommitAuditRecord = {
  id: string;
  requestId: string;
  planModeDraftId: string;
  selectedOptionId: PlanOptionDraft["id"];
  deckId: string;
  cardIds: string[];
  createdAt: string;
  writes: {
    deckCommitted: true;
    cardsCommitted: number;
    proofOutboxQueued: true;
    proofAppended: boolean;
  };
};

export type DeckCommitResponse = {
  deck: CommittedDeck;
  cards: CommittedCard[];
  audit: DeckCommitAuditRecord;
  proofOutbox: ProofOutboxRecord;
  proofEvents: ProofEvent[];
};

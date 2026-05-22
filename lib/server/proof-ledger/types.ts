export type ProofEventType =
  | "deck_committed"
  | "card_started"
  | "card_completed"
  | "card_frozen"
  | "burn_started"
  | "burn_completed"
  | "card_deferred"
  | "reward_created"
  | "schedule_inserted"
  | "deadline_warning"
  | "reminder_created";

export type ProofEventSourceService = "deck-commit" | "card-runtime" | "time-guardian" | "proof-ledger";

export type ProofEventActor = "user" | "system-service";

export type ProofEventRequest = {
  id: string;
  type: ProofEventType;
  deckId?: string;
  cardId?: string;
  actor: ProofEventActor;
  sourceService: ProofEventSourceService;
  createdAt: string;
  summary: string;
  details?: string;
  metadata?: Record<string, unknown>;
};

export type ProofEvent = ProofEventRequest & {
  ledgerSequence: number;
  appendedAt: string;
};

export type ProofOutboxRecord = {
  id: string;
  request: ProofEventRequest;
  status: "pending" | "processed" | "failed";
  attempts: number;
  createdAt: string;
  processedAt?: string;
  error?: string;
};

export type ProofTimeline = {
  events: ProofEvent[];
};

export type ProofTimelineEntry = {
  id: string;
  occurredAt: string;
  type:
    | "deck_committed"
    | "card_started"
    | "card_completed"
    | "card_frozen"
    | "burn_started"
    | "burn_completed"
    | "card_deferred"
    | "deadline_warning"
    | "reminder_created";
  deckId?: string;
  cardId?: string;
  title: string;
  statusColor: "gray" | "blue" | "green" | "ice" | "orange" | "red" | "gold";
  userVisibleCopy: string;
  nextSuggestion?: string;
  source: "proof-ledger";
};

export type ProofTimelineSummary = {
  totalEntries: number;
  committedDecks: number;
  completedCards: number;
  frozenCards: number;
  burningEvents: number;
  deferredCards: number;
  latestOccurredAt?: string;
  nextSuggestion: string;
};

export type ProofTimelineProjectionResult = {
  entries: ProofTimelineEntry[];
  summary: ProofTimelineSummary;
  boundaryWarnings: string[];
};

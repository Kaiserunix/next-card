export type ProofEventType =
  | "deck_committed"
  | "card_completed"
  | "card_frozen"
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

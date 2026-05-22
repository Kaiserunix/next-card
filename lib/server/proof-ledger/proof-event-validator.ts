import type { ProofEventRequest } from "@/lib/server/proof-ledger/types";

export class ProofLedgerError extends Error {
  constructor(
    public readonly code: "INVALID_PROOF_EVENT" | "PROOF_LEDGER_WRITE_FAILED",
    message: string,
    public readonly status = 400,
    public readonly recoverable = true,
  ) {
    super(message);
    this.name = "ProofLedgerError";
  }
}

const SHAMING_COPY = [
  "lazy",
  "worthless",
  "failure",
  "失败者",
  "废物",
  "没救",
  "太差",
  "懒",
];

export function validateProofEventRequest(input: ProofEventRequest): ProofEventRequest {
  if (!input.id || !input.type || !input.actor || !input.sourceService || !input.createdAt || !input.summary) {
    throw new ProofLedgerError("INVALID_PROOF_EVENT", "Proof event is missing required fields.");
  }

  const searchable = `${input.summary}\n${input.details ?? ""}`.toLowerCase();
  const shamingWord = SHAMING_COPY.find((word) => searchable.includes(word.toLowerCase()));
  if (shamingWord) {
    throw new ProofLedgerError("INVALID_PROOF_EVENT", `Proof event contains shaming copy: ${shamingWord}.`);
  }

  if (input.type === "deck_committed") {
    if (!input.deckId) {
      throw new ProofLedgerError("INVALID_PROOF_EVENT", "deck_committed proof requires deckId.");
    }

    if (input.metadata?.status === "completed") {
      throw new ProofLedgerError("INVALID_PROOF_EVENT", "deck_committed must not claim completion.");
    }
  }

  if (input.type === "card_completed" && input.sourceService !== "card-runtime") {
    throw new ProofLedgerError("INVALID_PROOF_EVENT", "card_completed proof can only come from Card Runtime.");
  }

  if (input.sourceService === "deck-commit" && input.type !== "deck_committed") {
    throw new ProofLedgerError("INVALID_PROOF_EVENT", "Deck Commit can only request deck_committed proof.");
  }

  return input;
}

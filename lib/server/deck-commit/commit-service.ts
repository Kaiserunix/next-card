import { PlanModeServiceError } from "@/lib/server/plan-mode/errors";
import {
  JsonFilePlanModeDraftRepository,
  type PlanModeDraftRepository,
} from "@/lib/server/plan-mode/plan-mode-repository";
import { compileCommittedDeck } from "@/lib/server/deck-commit/deck-compiler";
import {
  DeckCommitError,
  validateDeckCommitRequest,
  validateDraftCanCommit,
  validateNoExistingCommit,
  validateSelectedOption,
} from "@/lib/server/deck-commit/commit-validator";
import {
  JsonFileDeckCommitRepository,
  type DeckCommitRepository,
} from "@/lib/server/deck-commit/json-repositories";
import type { DeckCommitAuditRecord, DeckCommitResponse } from "@/lib/server/deck-commit/types";
import { ProofOutboxService } from "@/lib/server/proof-ledger/proof-outbox-service";
import type { ProofEventRequest } from "@/lib/server/proof-ledger/types";

export type DeckCommitServiceOptions = {
  planModeRepository?: PlanModeDraftRepository;
  deckRepository?: DeckCommitRepository;
  proofOutboxService?: ProofOutboxService;
  now?: () => string;
};

export class DeckCommitService {
  private readonly planModeRepository: PlanModeDraftRepository;
  private readonly deckRepository: DeckCommitRepository;
  private readonly proofOutboxService: ProofOutboxService;
  private readonly now: () => string;

  constructor(options: DeckCommitServiceOptions = {}) {
    this.planModeRepository = options.planModeRepository ?? new JsonFilePlanModeDraftRepository();
    this.deckRepository = options.deckRepository ?? new JsonFileDeckCommitRepository();
    this.proofOutboxService = options.proofOutboxService ?? new ProofOutboxService();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async commit(input: unknown): Promise<DeckCommitResponse> {
    const request = validateDeckCommitRequest(input);
    const draft = validateDraftCanCommit(await this.getDraft(request.planModeDraftId));
    validateNoExistingCommit(await this.deckRepository.findDeckByPlanModeDraft(draft.id));
    const option = validateSelectedOption(draft, request.selectedOptionId);
    const createdAt = request.clientContext?.now ?? this.now();
    const { deck, cards } = compileCommittedDeck({ draft, option, request, createdAt });

    await this.deckRepository.saveDeck(deck);
    await this.deckRepository.saveCards(cards);

    const proofRequest: ProofEventRequest = {
      id: `proof_deck_committed_${deck.deckId}`,
      type: "deck_committed",
      deckId: deck.deckId,
      actor: "user",
      sourceService: "deck-commit",
      createdAt,
      summary: `用户选择 ${option.mode} 方案并生成执行卡组。`,
      details: `Deck Commit only records the selected option ${option.id}; unselected options were not committed.`,
      metadata: {
        planModeDraftId: draft.id,
        selectedOptionId: option.id,
        committedCardCount: cards.length,
      },
    };

    const proofOutbox = await this.proofOutboxService.enqueue(proofRequest);
    const processed = await this.proofOutboxService.processPending();
    const audit: DeckCommitAuditRecord = {
      id: `audit_${deck.deckId}`,
      requestId: request.requestId,
      planModeDraftId: draft.id,
      selectedOptionId: option.id,
      deckId: deck.deckId,
      cardIds: cards.map((card) => card.cardId),
      createdAt,
      writes: {
        deckCommitted: true,
        cardsCommitted: cards.length,
        proofOutboxQueued: true,
        proofAppended: processed.processed.length > 0,
      },
    };
    await this.deckRepository.saveAudit(audit);

    return {
      deck,
      cards,
      audit,
      proofOutbox,
      proofEvents: processed.processed,
    };
  }

  private async getDraft(id: string) {
    try {
      return await this.planModeRepository.getDraft(id);
    } catch (error) {
      if (error instanceof PlanModeServiceError) throw error;
      throw new DeckCommitError("PLAN_MODE_DRAFT_NOT_FOUND", "Plan Mode draft was not found.", 404, true);
    }
  }
}

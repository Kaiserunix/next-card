import {
  JsonFileDeckCommitRepository,
  type DeckCommitRepository,
} from "@/lib/server/deck-commit/json-repositories";
import type { CommittedCard } from "@/lib/server/deck-commit/types";
import {
  JsonFileCardRuntimeRepository,
  type CardRuntimeRepository,
} from "@/lib/server/card-runtime/card-runtime-repository";
import {
  CardRuntimeError,
  requireCommittedCard,
  requireCommittedDeck,
  validateCardRuntimeActionRequest,
  validateTransition,
} from "@/lib/server/card-runtime/card-runtime-validator";
import type {
  CardRuntimeAction,
  CardRuntimeActionRequest,
  CardRuntimeActionResponse,
  CardRuntimeEvent,
  CardRuntimeState,
} from "@/lib/server/card-runtime/types";
import { JsonFileProofLedgerRepository, type ProofLedgerRepository } from "@/lib/server/proof-ledger/proof-ledger-repository";
import { JsonFileProofOutboxRepository, ProofOutboxService } from "@/lib/server/proof-ledger/proof-outbox-service";
import type { ProofEvent, ProofEventRequest, ProofEventType } from "@/lib/server/proof-ledger/types";
import { buildScheduleSnapshot } from "@/lib/server/time-guardian/schedule-snapshot-builder";
import { decideDeferCard } from "@/lib/server/time-guardian/defer-decision-service";
import { validateQueueAction } from "@/lib/server/time-guardian/queue-action-validator";
import type { CommittedCardRef, QueueAction, ScheduledCardRef, TimeWindow } from "@/lib/server/time-guardian/types";

export type CardRuntimeServiceOptions = {
  deckRepository?: DeckCommitRepository;
  runtimeRepository?: CardRuntimeRepository;
  proofOutboxService?: ProofOutboxService;
  proofLedgerRepository?: ProofLedgerRepository;
  now?: () => string;
};

export class CardRuntimeService {
  private readonly deckRepository: DeckCommitRepository;
  private readonly runtimeRepository: CardRuntimeRepository;
  private readonly proofOutboxService: ProofOutboxService;
  private readonly proofLedgerRepository: ProofLedgerRepository;
  private readonly now: () => string;

  constructor(options: CardRuntimeServiceOptions = {}) {
    this.deckRepository = options.deckRepository ?? new JsonFileDeckCommitRepository();
    this.runtimeRepository = options.runtimeRepository ?? new JsonFileCardRuntimeRepository();
    this.proofLedgerRepository = options.proofLedgerRepository ?? new JsonFileProofLedgerRepository();
    this.proofOutboxService =
      options.proofOutboxService ??
      new ProofOutboxService(new JsonFileProofOutboxRepository(), this.proofLedgerRepository);
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async applyAction(input: unknown): Promise<CardRuntimeActionResponse> {
    const request = validateCardRuntimeActionRequest(input);
    const existingEvent = await this.runtimeRepository.findEventByRequestId(request.requestId);
    if (existingEvent) {
      assertIdempotentReplayMatches(existingEvent, request);
      return this.replayExistingEvent(existingEvent);
    }

    const deck = requireCommittedDeck(await this.deckRepository.getDeck(request.deckId), request.deckId);
    const cards = await this.deckRepository.listCardsByDeck(deck.deckId);
    const card = requireCommittedCard(cards, request.cardId);
    const now = request.clientContext?.now ?? this.now();
    const current = (await this.runtimeRepository.getState(deck.deckId, card.cardId)) ?? initialState(card, now);
    validateTransition(current, request.action);

    const result = await this.applyTransition({ request, card, current, now });
    const savedState = result.saveState ? await this.runtimeRepository.saveState(result.nextState) : current;
    if (!result.saveState && !(await this.runtimeRepository.getState(deck.deckId, card.cardId))) {
      await this.runtimeRepository.saveState(current);
    }
    const proofEvents = await this.writeProofEvents(result.proofRequests);
    const event: CardRuntimeEvent = {
      id: `card_runtime_event_${request.requestId}`,
      requestId: request.requestId,
      deckId: request.deckId,
      cardId: request.cardId,
      action: request.action,
      createdAt: now,
      stateStatus: savedState.status,
      proofEventIds: proofEvents.map((proof) => proof.id),
      timeGuardianActions: result.timeGuardianActions,
      rejected: !result.saveState,
      rejectionReason: result.rejectionReason,
    };
    await this.runtimeRepository.saveEvent(event);

    return {
      cardRuntimeState: savedState,
      proofEvents,
      timeGuardianActions: result.timeGuardianActions,
      boundaryWarnings: boundaryWarnings(event),
    };
  }

  private async applyTransition(input: {
    request: CardRuntimeActionRequest;
    card: CommittedCard;
    current: CardRuntimeState;
    now: string;
  }): Promise<{
    nextState: CardRuntimeState;
    proofRequests: ProofEventRequest[];
    timeGuardianActions: QueueAction[];
    saveState: boolean;
    rejectionReason?: string;
  }> {
    const { request, card, current, now } = input;
    const nextState: CardRuntimeState = {
      ...current,
      lastAction: request.action,
      lastActionAt: now,
      updatedAt: now,
    };
    const proofRequests: ProofEventRequest[] = [];
    const timeGuardianActions: QueueAction[] = [];
    let saveState = true;
    let rejectionReason: string | undefined;

    if (request.action === "start") {
      nextState.status = "active";
      nextState.startedAt ??= now;
      proofRequests.push(proofRequest(request, "card_started", now, "开始执行卡片。"));
    }

    if (request.action === "complete") {
      nextState.status = "completed";
      nextState.completedAt = now;
      nextState.actualMinutes = request.actualMinutes ?? current.actualMinutes;
      proofRequests.push(proofRequest(request, "card_completed", now, "完成一张执行卡片。", { actualMinutes: request.actualMinutes }));
    }

    if (request.action === "freeze") {
      const snapshot = buildFreezeRuntimeSnapshot(request, card, now);
      const freezeAction = createFreezeAction(request, card, now, snapshot.id);
      const validation = validateQueueAction(freezeAction, {
        snapshot,
        expectedChosenPlanId: card.selectedOptionId,
        notificationCapability: request.notificationCapability ?? "in_app_only",
      });

      if (validation.allowed) {
        nextState.status = "frozen";
        nextState.frozenAt = now;
        proofRequests.push(proofRequest(request, "card_frozen", now, "卡片已冻结，保留上下文等待恢复安排。"));
        timeGuardianActions.push(freezeAction);
      } else {
        const reviewAction = createFreezeReviewAction(request, card, now, validation.reason, snapshot.id);
        timeGuardianActions.push(reviewAction);
        saveState = false;
        rejectionReason = validation.reason;
      }
    }

    if (request.action === "burn_start") {
      nextState.status = "burning";
      nextState.burnStartedAt = now;
      proofRequests.push(proofRequest(request, "burn_started", now, "进入快速燃烧压力提醒。"));
    }

    if (request.action === "burn_complete") {
      nextState.status = "active";
      nextState.burnCompletedAt = now;
      proofRequests.push(proofRequest(request, "burn_completed", now, "快速燃烧提醒结束，任务仍可继续或重新安排。"));
    }

    if (request.action === "resume") {
      nextState.status = "active";
      nextState.resumedAt = now;
      proofRequests.push(proofRequest(request, "card_started", now, "恢复执行卡片。"));
    }

    if (request.action === "defer") {
      if (!request.deferToWindow) {
        const reviewAction = createDeferReviewAction(request, card, now, "Defer requires a target time window.");
        timeGuardianActions.push(reviewAction);
        saveState = false;
        rejectionReason = reviewAction.reason;
      } else {
        const deferResult = decideDeferCard({
          snapshot: buildRuntimeSnapshot(request, card, now, request.deferToWindow),
          card: toCommittedCardRef(card),
          toWindow: request.deferToWindow,
          fromWindow: request.fromWindow,
        });
        const validation = validateQueueAction(deferResult.action, {
          snapshot: buildRuntimeSnapshot(request, card, now, request.deferToWindow),
          expectedChosenPlanId: card.selectedOptionId,
          notificationCapability: request.notificationCapability ?? "in_app_only",
        });
        timeGuardianActions.push(deferResult.action);
        if (deferResult.action.type === "defer-card" && validation.allowed) {
          nextState.status = "deferred";
          nextState.deferredAt = now;
          proofRequests.push(proofRequest(request, "card_deferred", now, "卡片已推迟到经过时间校验的窗口。"));
        } else {
          saveState = false;
          rejectionReason = validation.reason;
        }
      }
    }

    return { nextState, proofRequests, timeGuardianActions, saveState, rejectionReason };
  }

  private async writeProofEvents(requests: ProofEventRequest[]): Promise<ProofEvent[]> {
    const ids = new Set(requests.map((request) => request.id));
    for (const request of requests) {
      await this.proofOutboxService.enqueue(request);
    }
    const processed = await this.proofOutboxService.processPending();
    return processed.processed.filter((event) => ids.has(event.id));
  }

  private async replayExistingEvent(event: CardRuntimeEvent): Promise<CardRuntimeActionResponse> {
    const state = await this.runtimeRepository.getState(event.deckId, event.cardId);
    const proofEvents = (await this.proofLedgerRepository.listEvents()).filter((proof) => event.proofEventIds.includes(proof.id));
    if (!state) {
      throw new Error(`Card runtime state missing for idempotent request ${event.requestId}`);
    }
    return {
      cardRuntimeState: state,
      proofEvents,
      timeGuardianActions: event.timeGuardianActions,
      boundaryWarnings: [...boundaryWarnings(event), "idempotent-replay: duplicate requestId returned existing result"],
    };
  }
}

function assertIdempotentReplayMatches(event: CardRuntimeEvent, request: CardRuntimeActionRequest): void {
  if (event.deckId === request.deckId && event.cardId === request.cardId && event.action === request.action) return;

  throw new CardRuntimeError(
    "CARD_RUNTIME_IDEMPOTENCY_CONFLICT",
    "requestId was already used for a different card runtime command.",
    409,
    true,
  );
}

function initialState(card: CommittedCard, now: string): CardRuntimeState {
  return {
    deckId: card.deckId,
    cardId: card.cardId,
    selectedOptionId: card.selectedOptionId,
    status: "queued",
    actualMinutes: 0,
    elapsedSeconds: 0,
    lastAction: "created",
    lastActionAt: now,
    updatedAt: now,
  };
}

function proofRequest(
  request: CardRuntimeActionRequest,
  type: ProofEventType,
  now: string,
  summary: string,
  metadata: Record<string, unknown> = {},
): ProofEventRequest {
  return {
    id: `proof_${type}_${request.deckId}_${request.cardId}_${request.requestId}`,
    type,
    deckId: request.deckId,
    cardId: request.cardId,
    actor: "user",
    sourceService: "card-runtime",
    createdAt: now,
    summary,
    details: request.reason,
    metadata: {
      requestId: request.requestId,
      action: request.action,
      ...metadata,
    },
  };
}

function createFreezeAction(request: CardRuntimeActionRequest, card: CommittedCard, now: string, snapshotId: string): QueueAction {
  return {
    type: "freeze-card",
    id: `action_freeze_${card.cardId}_${request.requestId}`,
    snapshotId,
    actor: "user",
    reason: request.reason ?? "User froze the card and saved context for review.",
    createdAt: now,
    chosenPlanId: card.selectedOptionId,
    cardId: card.cardId,
    deckId: card.deckId,
  };
}

function createFreezeReviewAction(
  request: CardRuntimeActionRequest,
  card: CommittedCard,
  now: string,
  reason: string,
  snapshotId: string,
): QueueAction {
  return {
    type: "request-user-review",
    id: `action_review_freeze_${card.cardId}_${request.requestId}`,
    snapshotId,
    actor: "system-service",
    reason,
    createdAt: now,
    chosenPlanId: card.selectedOptionId,
    reviewReason: reason,
    affectedCardIds: [card.cardId],
    recoveryOptions: [
      {
        id: "retry_freeze",
        kind: "ask-user",
        label: "Confirm freeze again",
        reason: "Freeze must pass Time Guardian queue action validation before saving card context.",
      },
    ],
  };
}

function createDeferReviewAction(request: CardRuntimeActionRequest, card: CommittedCard, now: string, reason: string): QueueAction {
  return {
    type: "request-user-review",
    id: `action_review_defer_${card.cardId}_${request.requestId}`,
    snapshotId: `snapshot_card_runtime_${request.requestId}`,
    actor: "system-service",
    reason,
    createdAt: now,
    chosenPlanId: card.selectedOptionId,
    reviewReason: reason,
    affectedCardIds: [card.cardId],
    recoveryOptions: [
      {
        id: "choose_defer_window",
        kind: "reschedule",
        label: "Choose a safer window",
        reason: "Deferred cards must avoid hard time locks.",
      },
    ],
  };
}

function buildFreezeRuntimeSnapshot(request: CardRuntimeActionRequest, card: CommittedCard, now: string) {
  return buildScheduleSnapshot({
    now,
    timezone: request.clientContext?.timezone ?? "Asia/Shanghai",
    committedDecks: [{ deckId: card.deckId, chosenPlanId: card.selectedOptionId, title: card.title }],
    activeCards: [toScheduledCardRef(card)],
    scheduledEvents: [],
    timeLocks: request.timeLocks ?? [],
    availableWindows: request.availableWindows ?? [],
    frozenQueue: [],
    policySnapshotId: "card-runtime-policy",
  }).snapshot;
}

function buildRuntimeSnapshot(
  request: CardRuntimeActionRequest,
  card: CommittedCard,
  now: string,
  deferWindow: TimeWindow,
) {
  return buildScheduleSnapshot({
    now,
    timezone: request.clientContext?.timezone ?? deferWindow.timezone,
    committedDecks: [{ deckId: card.deckId, chosenPlanId: card.selectedOptionId, title: card.title }],
    activeCards: [],
    scheduledEvents: [],
    timeLocks: request.timeLocks ?? [],
    availableWindows: request.availableWindows ?? [deferWindow],
    frozenQueue: [],
    policySnapshotId: "card-runtime-policy",
  }).snapshot;
}

function toScheduledCardRef(card: CommittedCard): ScheduledCardRef {
  return {
    cardId: card.cardId,
    deckId: card.deckId,
    chosenPlanId: card.selectedOptionId,
    tension: card.tension,
    estimatedMinutes: card.estimatedMinutes,
    deadlineAt: card.deadlineAt,
    hardLockRefs: card.hardLockRefs,
    nudgeReminderIds: [],
    scheduleStatus: "active",
  };
}

function toCommittedCardRef(card: CommittedCard): CommittedCardRef {
  return {
    cardId: card.cardId,
    deckId: card.deckId,
    chosenPlanId: card.selectedOptionId,
    title: card.title,
    tension: card.tension,
    estimatedMinutes: card.estimatedMinutes,
    deadlineAt: card.deadlineAt,
    hardLockRefs: card.hardLockRefs,
    preferredStartAt: card.preferredStartAt,
  };
}

function boundaryWarnings(event: CardRuntimeEvent): string[] {
  return [
    "card-runtime-authoritative: card completion proof can only be emitted by Card Runtime",
    "selected-deck-only: actions apply only to committed cards from the selected Plan Mode option",
    "pressure-not-punishment: burn and freeze are status signals, not failure or diagnosis",
    ...(event.rejected ? [`action-rejected: ${event.rejectionReason ?? "requires user review"}`] : []),
  ];
}

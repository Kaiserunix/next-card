import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { JsonFileCardRuntimeRepository } from "@/lib/server/card-runtime/card-runtime-repository";
import { CardRuntimeService } from "@/lib/server/card-runtime/card-runtime-service";
import { ImportReviewService } from "@/lib/server/import-review/import-review-service";
import type { ImportReviewCommand, ImportReviewReport } from "@/lib/server/import-review/types";
import { JsonFileImportConfirmationSessionRepository } from "@/lib/server/import-review/confirmation-session-repository";
import { ImportConfirmationService } from "@/lib/server/import-review/import-confirmation-service";
import { JsonFilePlanModeDraftRepository } from "@/lib/server/plan-mode/plan-mode-repository";
import { PlanModeService } from "@/lib/server/plan-mode/plan-mode-service";
import type { PlanModeRequest } from "@/lib/server/plan-mode/types";
import { DeckCommitService } from "@/lib/server/deck-commit/commit-service";
import { JsonFileDeckCommitRepository } from "@/lib/server/deck-commit/json-repositories";
import { JsonFileProofLedgerRepository } from "@/lib/server/proof-ledger/proof-ledger-repository";
import { JsonFileProofOutboxRepository, ProofOutboxService } from "@/lib/server/proof-ledger/proof-outbox-service";
import { projectProofTimeline } from "@/lib/server/proof-ledger/proof-timeline-projection";
import { buildScheduleSnapshot } from "@/lib/server/time-guardian/schedule-snapshot-builder";
import { scheduleCommittedDeck } from "@/lib/server/time-guardian/scheduling-kernel";
import { addMinutes } from "@/lib/server/time-guardian/time-overlap";
import type { CommittedCardRef, CommittedDeckRef, NotificationCapability, QueueAction, TimeLock, TimeWindow } from "@/lib/server/time-guardian/types";
import type {
  BackendRunError,
  BackendRunReport,
  BackendSandboxCardAction,
  BackendSandboxRunCommand,
} from "@/lib/server/backend-orchestrator/types";
import type { MultimodalExtractionPort } from "@/lib/server/input-layer/multimodal-port";

export type BackendSandboxRunServiceOptions = {
  sandboxRootDir?: string;
  importReviewServiceFactory?: (runDir: string) => ImportReviewService;
  multimodalExtractor?: MultimodalExtractionPort;
  now?: () => string;
};

const DEFAULT_SANDBOX_ROOT = join(process.cwd(), ".nextcard-data", "sandbox-runs");

export class BackendSandboxRunService {
  constructor(private readonly options: BackendSandboxRunServiceOptions = {}) {}

  async run(input: unknown): Promise<BackendRunReport> {
    const command = validateBackendSandboxRunCommand(input);
    const reportId = `backend_run_${randomUUID()}`;
    const now = command.clientContext?.now ?? this.options.now?.() ?? new Date().toISOString();
    const timezone = command.clientContext?.timezone ?? "Asia/Shanghai";
    const runDir = join(this.options.sandboxRootDir ?? process.env.NEXTCARD_SANDBOX_RUN_DIR ?? DEFAULT_SANDBOX_ROOT, reportId);
    const boundaryWarnings = [
      "sandbox-only: formal deck/proof stores are not used",
      "review-gate-authoritative: strict or blocked import review stops before Plan Mode",
      "must-select-option: sandbox deck commit requires an explicit selectedOptionId",
      "selected-option-only: unselected A/B/C options are not scheduled",
    ];
    const errors: BackendRunError[] = [];
    const sessionRepository = new JsonFileImportConfirmationSessionRepository(join(runDir, "import-review-sessions.json"));
    const importReview = await this.createImportReviewService(runDir, sessionRepository).review(this.toImportReviewCommand(command, now, timezone));
    const report: BackendRunReport = {
      reportId,
      sandbox: true,
      importReview,
      cardRuntimeActions: [],
      timeGuardianActions: [],
      proofTimeline: [],
      boundaryWarnings,
      errors,
    };

    if ((command.confirmation || command.confirmedFacts) && importReview.reviewSessionId) {
      const confirmation = await new ImportConfirmationService({
        repository: sessionRepository,
        now: () => now,
      }).confirm({
        reviewSessionId: importReview.reviewSessionId,
        action: command.confirmation?.action ?? (command.confirmedFacts ? "correct" : "confirm"),
        corrections: command.confirmation?.corrections ?? (command.confirmedFacts ? { missingFacts: command.confirmedFacts } : undefined),
        clientContext: command.confirmation?.clientContext ?? command.clientContext,
      });
      report.importConfirmation = confirmation;
      report.importReview = {
        ...importReview,
        canProceedToPlanMode: Boolean(confirmation.planCompilerHandoff),
        planCompilerHandoff: confirmation.planCompilerHandoff,
      };
    }

    if (!report.importReview.canProceedToPlanMode || !report.importReview.planCompilerHandoff) {
      errors.push({
        stage: "import-review",
        message: "Import review did not produce a confirmed PlanCompilerHandoff.",
        recoverable: true,
      });
      return report;
    }

    if (!command.selectedOptionId) {
      errors.push({
        stage: "deck-commit",
        message: "Sandbox run requires an explicit selectedOptionId before deck commit.",
        recoverable: true,
      });
      return report;
    }

    const planRepository = new JsonFilePlanModeDraftRepository(join(runDir, "plan-mode-drafts.json"));
    const planMode = new PlanModeService({
      repository: planRepository,
      now: () => now,
    });
    const planModeResponse = await planMode.createDraft(this.toPlanModeRequest(report.importReview, command, now, timezone, reportId));
    report.planModeDraft = planModeResponse.draft;

    const ledger = new JsonFileProofLedgerRepository(join(runDir, "proof-ledger.json"));
    const deckRepository = new JsonFileDeckCommitRepository({
      decksFile: join(runDir, "decks.json"),
      cardsFile: join(runDir, "cards.json"),
      auditFile: join(runDir, "deck-commit-audit.json"),
    });
    const proofOutbox = new ProofOutboxService(
      new JsonFileProofOutboxRepository(join(runDir, "proof-outbox.json")),
      ledger,
      () => now,
    );
    const commitService = new DeckCommitService({
      planModeRepository: planRepository,
      deckRepository,
      proofOutboxService: proofOutbox,
      now: () => now,
    });
    const commit = await commitService.commit({
      requestId: `commit_${reportId}`,
      planModeDraftId: planModeResponse.draft.id,
      selectedOptionId: command.selectedOptionId,
      anonymousDeviceId: command.clientContext?.anonymousDeviceId,
      userId: command.clientContext?.userId,
      clientContext: { now, timezone },
    });
    report.committedDeck = commit.deck;
    report.committedCards = commit.cards;
    const runtimeRepository = new JsonFileCardRuntimeRepository(join(runDir, "card-runtime.json"));
    const runtimeService = new CardRuntimeService({
      deckRepository,
      runtimeRepository,
      proofLedgerRepository: ledger,
      proofOutboxService: proofOutbox,
      now: () => now,
    });

    const scheduled = scheduleCommittedDeck({
      snapshot: buildScheduleSnapshot({
        now,
        timezone,
        committedDecks: [toScheduledDeck(commit.deck)],
        activeCards: [],
        scheduledEvents: [],
        timeLocks: command.timeLocks ?? [],
        availableWindows: command.availableWindows ?? [defaultWindow(now, timezone)],
        frozenQueue: [],
        policySnapshotId: "sandbox-policy",
      }).snapshot,
      deck: toScheduledDeck(commit.deck),
      cards: commit.cards.map(toScheduledCard),
      chosenPlanId: command.selectedOptionId,
    });
    report.timeGuardianActions = scheduled.queueActions;
    for (const [index, action] of (command.cardActions ?? []).entries()) {
      const cardId = action.cardId ?? commit.cards[0]?.cardId;
      if (!cardId) continue;
      const runtimeResult = await runtimeService.applyAction({
        requestId: action.requestId ?? `card_action_${reportId}_${index + 1}_${action.action}`,
        deckId: commit.deck.deckId,
        cardId,
        action: action.action,
        actualMinutes: action.actualMinutes,
        reason: action.reason,
        deferToWindow: action.deferToWindow,
        fromWindow: action.fromWindow,
        timeLocks: command.timeLocks,
        availableWindows: command.availableWindows,
        notificationCapability: command.notificationCapability,
        clientContext: command.clientContext,
      });
      report.cardRuntimeActions.push(runtimeResult);
      report.timeGuardianActions.push(...runtimeResult.timeGuardianActions);
    }
    report.proofTimeline = (
      await projectProofTimeline({
        ledger,
        deckRepository,
        runtimeRepository,
        filters: { deckId: commit.deck.deckId, sandboxRunId: reportId },
      })
    ).entries;
    return report;
  }

  private createImportReviewService(runDir: string, sessionRepository: JsonFileImportConfirmationSessionRepository): ImportReviewService {
    if (this.options.importReviewServiceFactory) return this.options.importReviewServiceFactory(runDir);
    return new ImportReviewService({
      multimodalExtractor: this.options.multimodalExtractor,
      confirmationSessionRepository: sessionRepository,
      uploadDir: join(runDir, "uploads"),
      preparedImageDir: join(runDir, "prepared-images"),
    });
  }

  private toImportReviewCommand(command: BackendSandboxRunCommand, now: string, timezone: string): ImportReviewCommand {
    return {
      sourceType: command.sourceType,
      text: command.text,
      filePath: command.filePath,
      clientContext: {
        now,
        timezone,
        locale: command.clientContext?.locale ?? "zh-CN",
        anonymousDeviceId: command.clientContext?.anonymousDeviceId,
        userId: command.clientContext?.userId,
      },
      sandboxMode: true,
      confirmationAction: command.autoConfirmLightReview === false ? undefined : "confirm",
    };
  }

  private toPlanModeRequest(
    importReview: ImportReviewReport,
    command: BackendSandboxRunCommand,
    now: string,
    timezone: string,
    reportId: string,
  ): PlanModeRequest {
    return {
      requestId: `plan_mode_${reportId}`,
      operation: "generate",
      source: sourceForImport(importReview.sourceType),
      planCompilerHandoff: importReview.planCompilerHandoff!,
      confirmedTranscriptId: importReview.sourceType === "voice" ? `sandbox_transcript_${importReview.rawInputId}` : undefined,
      anonymousDeviceId: command.clientContext?.anonymousDeviceId,
      userId: command.clientContext?.userId,
      clientContext: {
        now,
        timezone,
        locale: command.clientContext?.locale ?? "zh-CN",
      },
    };
  }
}

export function validateBackendSandboxRunCommand(input: unknown): BackendSandboxRunCommand {
  if (!isRecord(input) || !isSourceType(input.sourceType)) {
    throw new BackendSandboxRunValidationError("Backend sandbox run requires a valid sourceType.");
  }

  return {
    sourceType: input.sourceType,
    text: typeof input.text === "string" ? input.text : undefined,
    filePath: typeof input.filePath === "string" ? input.filePath : undefined,
    selectedOptionId: isSelectedOptionId(input.selectedOptionId) ? input.selectedOptionId : undefined,
    autoConfirmLightReview:
      typeof input.autoConfirmLightReview === "boolean" ? input.autoConfirmLightReview : undefined,
    confirmation: readConfirmation(input),
    confirmedFacts: isRecord(input.confirmedFacts) ? readMissingFacts(input.confirmedFacts) : undefined,
    cardActions: readCardActions(input.cardActions),
    notificationCapability: readNotificationCapability(input.notificationCapability),
    clientContext: isRecord(input.clientContext)
      ? {
          now: typeof input.clientContext.now === "string" ? input.clientContext.now : undefined,
          timezone: typeof input.clientContext.timezone === "string" ? input.clientContext.timezone : undefined,
          locale: isLocale(input.clientContext.locale) ? input.clientContext.locale : undefined,
          anonymousDeviceId:
            typeof input.clientContext.anonymousDeviceId === "string" ? input.clientContext.anonymousDeviceId : undefined,
          userId: typeof input.clientContext.userId === "string" ? input.clientContext.userId : undefined,
        }
      : undefined,
    availableWindows: readTimeWindows(input.availableWindows),
    timeLocks: readTimeLocks(input.timeLocks),
  };
}

export class BackendSandboxRunValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendSandboxRunValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSourceType(value: unknown): value is BackendSandboxRunCommand["sourceType"] {
  return (
    value === "voice" ||
    value === "manual-dictation" ||
    value === "text" ||
    value === "image" ||
    value === "pdf" ||
    value === "docx" ||
    value === "notification" ||
    value === "mixed"
  );
}

function isSelectedOptionId(value: unknown): value is NonNullable<BackendSandboxRunCommand["selectedOptionId"]> {
  return value === "plan-a" || value === "plan-b" || value === "plan-c";
}

function readNotificationCapability(value: unknown): NotificationCapability | undefined {
  return value === "unknown" ||
    value === "external_granted" ||
    value === "external_denied" ||
    value === "external_revoked" ||
    value === "in_app_only"
    ? value
    : undefined;
}

function readConfirmation(input: Record<string, unknown>): BackendSandboxRunCommand["confirmation"] {
  const source = isRecord(input.confirmation)
    ? input.confirmation
    : typeof input.confirmationAction === "string"
      ? {
          action: input.confirmationAction,
          corrections: input.corrections,
        }
      : undefined;

  if (!source) return undefined;
  if (source.action !== "confirm" && source.action !== "correct" && source.action !== "reject") {
    throw new BackendSandboxRunValidationError("confirmation.action must be confirm, correct, or reject.");
  }
  return {
    action: source.action,
    corrections: isRecord(source.corrections)
      ? {
          facts: Array.isArray(source.corrections.facts)
            ? source.corrections.facts.map((fact) => {
                if (!isRecord(fact) || typeof fact.factId !== "string" || typeof fact.value !== "string") {
                  throw new BackendSandboxRunValidationError("confirmation.corrections.facts must contain factId and value.");
                }
                return { factId: fact.factId, value: fact.value };
              })
            : undefined,
          missingFacts: isRecord(source.corrections.missingFacts) ? readMissingFacts(source.corrections.missingFacts) : undefined,
        }
      : undefined,
  };
}

function readMissingFacts(input: Record<string, unknown>): NonNullable<BackendSandboxRunCommand["confirmedFacts"]> {
  const result: NonNullable<BackendSandboxRunCommand["confirmedFacts"]> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key !== "event" && key !== "time" && key !== "deadline" && key !== "location" && key !== "taskType" && key !== "lifecycle") {
      throw new BackendSandboxRunValidationError(`Unsupported confirmed fact field: ${key}.`);
    }
    if (typeof value === "string" && value.trim()) result[key] = value.trim();
  }
  return result;
}

function readCardActions(value: unknown): BackendSandboxCardAction[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item, index): BackendSandboxCardAction => {
    if (!isRecord(item)) throw new BackendSandboxRunValidationError(`cardActions[${index}] must be an object.`);
    if (
      item.action !== "start" &&
      item.action !== "complete" &&
      item.action !== "freeze" &&
      item.action !== "burn_start" &&
      item.action !== "burn_complete" &&
      item.action !== "defer" &&
      item.action !== "resume"
    ) {
      throw new BackendSandboxRunValidationError(`cardActions[${index}].action is invalid.`);
    }
    return {
      requestId: typeof item.requestId === "string" ? item.requestId : undefined,
      cardId: typeof item.cardId === "string" ? item.cardId : undefined,
      action: item.action,
      actualMinutes: typeof item.actualMinutes === "number" && Number.isFinite(item.actualMinutes) ? item.actualMinutes : undefined,
      reason: typeof item.reason === "string" ? item.reason : undefined,
      deferToWindow: readOptionalTimeWindow(item.deferToWindow),
      fromWindow: readOptionalTimeWindow(item.fromWindow),
    };
  });
}

function readTimeWindows(value: unknown): TimeWindow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => readRequiredTimeWindow(item));
}

function readOptionalTimeWindow(value: unknown): TimeWindow | undefined {
  if (value === undefined) return undefined;
  return readRequiredTimeWindow(value);
}

function readRequiredTimeWindow(value: unknown): TimeWindow {
  if (!isRecord(value)) throw new BackendSandboxRunValidationError("Time window must be an object.");
  const startAt = readString(value.startAt, "time window startAt");
  const endAt = readString(value.endAt, "time window endAt");
  if (Number.isNaN(Date.parse(startAt)) || Number.isNaN(Date.parse(endAt)) || Date.parse(endAt) <= Date.parse(startAt)) {
    throw new BackendSandboxRunValidationError("Time window startAt/endAt must be valid and ordered.");
  }
  return {
    id: readString(value.id, "time window id"),
    startAt,
    endAt,
    timezone: readString(value.timezone, "time window timezone"),
    source: value.source === "derived" || value.source === "user-stated" || value.source === "calendar-gap" || value.source === "default"
      ? value.source
      : "user-stated",
    confidence: typeof value.confidence === "number" ? value.confidence : 1,
  };
}

function readTimeLocks(value: unknown): TimeLock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item): TimeLock => {
    if (!isRecord(item)) throw new BackendSandboxRunValidationError("TimeLock must be an object.");
    const startAt = typeof item.startAt === "string" ? item.startAt : undefined;
    const endAt = typeof item.endAt === "string" ? item.endAt : undefined;
    const dueAt = typeof item.dueAt === "string" ? item.dueAt : undefined;
    if ((startAt && Number.isNaN(Date.parse(startAt))) || (endAt && Number.isNaN(Date.parse(endAt))) || (dueAt && Number.isNaN(Date.parse(dueAt)))) {
      throw new BackendSandboxRunValidationError("TimeLock contains an invalid date.");
    }
    if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) {
      throw new BackendSandboxRunValidationError("TimeLock endAt must be after startAt.");
    }
    return {
      id: readString(item.id, "time lock id"),
      userId: typeof item.userId === "string" ? item.userId : "anon",
      kind: item.kind === "class_time" || item.kind === "exam_time" || item.kind === "submission_deadline" || item.kind === "fixed_calendar_event" || item.kind === "user_locked_block"
        ? item.kind
        : "user_locked_block",
      startAt,
      endAt,
      dueAt,
      timezone: typeof item.timezone === "string" ? item.timezone : "Asia/Shanghai",
      movable: false,
      sourceRefs: Array.isArray(item.sourceRefs) ? (item.sourceRefs as TimeLock["sourceRefs"]) : [],
      reviewStatus: item.reviewStatus === "verified" || item.reviewStatus === "user-confirmed" ? item.reviewStatus : "user-confirmed",
      conflictStatus: item.conflictStatus === "conflict_detected" || item.conflictStatus === "resolved" ? item.conflictStatus : "none",
    };
  });
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BackendSandboxRunValidationError(`${label} is required.`);
  }
  return value.trim();
}

function isLocale(value: unknown): value is NonNullable<BackendSandboxRunCommand["clientContext"]>["locale"] {
  return value === "zh-CN" || value === "en" || value === "mixed" || value === "auto";
}

function sourceForImport(sourceType: ImportReviewReport["sourceType"]): PlanModeRequest["source"] {
  if (sourceType === "voice") return "voice-confirmed";
  if (sourceType === "manual-dictation") return "manual-dictation";
  if (sourceType === "image" || sourceType === "pdf" || sourceType === "docx" || sourceType === "mixed") {
    return "multimodal-confirmed";
  }
  return "text-confirmed";
}

function toScheduledDeck(deck: CommittedDeckRef | { deckId: string; selectedOptionId: string; title: string }): CommittedDeckRef {
  return {
    deckId: deck.deckId,
    chosenPlanId: "chosenPlanId" in deck ? deck.chosenPlanId : deck.selectedOptionId,
    title: deck.title,
  };
}

function toScheduledCard(card: {
  cardId: string;
  deckId: string;
  selectedOptionId: string;
  title: string;
  tension: CommittedCardRef["tension"];
  estimatedMinutes: number;
  deadlineAt?: string;
  hardLockRefs: string[];
  preferredStartAt?: string;
}): CommittedCardRef {
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

function defaultWindow(now: string, timezone: string): TimeWindow {
  return {
    id: "sandbox_default_window",
    startAt: now,
    endAt: addMinutes(now, 180),
    timezone,
    source: "default",
    confidence: 0.8,
  };
}

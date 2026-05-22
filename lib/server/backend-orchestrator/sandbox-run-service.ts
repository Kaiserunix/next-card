import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { ImportReviewService } from "@/lib/server/import-review/import-review-service";
import type { ImportReviewCommand, ImportReviewReport } from "@/lib/server/import-review/types";
import { JsonFilePlanModeDraftRepository } from "@/lib/server/plan-mode/plan-mode-repository";
import { PlanModeService } from "@/lib/server/plan-mode/plan-mode-service";
import type { PlanModeRequest } from "@/lib/server/plan-mode/types";
import { DeckCommitService } from "@/lib/server/deck-commit/commit-service";
import { JsonFileDeckCommitRepository } from "@/lib/server/deck-commit/json-repositories";
import { JsonFileProofLedgerRepository } from "@/lib/server/proof-ledger/proof-ledger-repository";
import { JsonFileProofOutboxRepository, ProofOutboxService } from "@/lib/server/proof-ledger/proof-outbox-service";
import { buildScheduleSnapshot } from "@/lib/server/time-guardian/schedule-snapshot-builder";
import { scheduleCommittedDeck } from "@/lib/server/time-guardian/scheduling-kernel";
import { addMinutes } from "@/lib/server/time-guardian/time-overlap";
import type { CommittedCardRef, CommittedDeckRef, QueueAction, TimeWindow } from "@/lib/server/time-guardian/types";
import type { BackendRunError, BackendRunReport, BackendSandboxRunCommand } from "@/lib/server/backend-orchestrator/types";
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
    const importReview = await this.createImportReviewService(runDir).review(this.toImportReviewCommand(command, now, timezone));
    const report: BackendRunReport = {
      reportId,
      sandbox: true,
      importReview,
      timeGuardianActions: [],
      proofTimeline: [],
      boundaryWarnings,
      errors,
    };

    if (!importReview.canProceedToPlanMode || !importReview.planCompilerHandoff) {
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
    const planModeResponse = await planMode.createDraft(this.toPlanModeRequest(importReview, command, now, timezone, reportId));
    report.planModeDraft = planModeResponse.draft;

    const ledger = new JsonFileProofLedgerRepository(join(runDir, "proof-ledger.json"));
    const commitService = new DeckCommitService({
      planModeRepository: planRepository,
      deckRepository: new JsonFileDeckCommitRepository({
        decksFile: join(runDir, "decks.json"),
        cardsFile: join(runDir, "cards.json"),
        auditFile: join(runDir, "deck-commit-audit.json"),
      }),
      proofOutboxService: new ProofOutboxService(
        new JsonFileProofOutboxRepository(join(runDir, "proof-outbox.json")),
        ledger,
        () => now,
      ),
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
    report.proofTimeline = (await ledger.getTimeline()).events;
    return report;
  }

  private createImportReviewService(runDir: string): ImportReviewService {
    if (this.options.importReviewServiceFactory) return this.options.importReviewServiceFactory(runDir);
    return new ImportReviewService({
      multimodalExtractor: this.options.multimodalExtractor,
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
    throw new Error("Backend sandbox run requires a valid sourceType.");
  }

  return {
    sourceType: input.sourceType,
    text: typeof input.text === "string" ? input.text : undefined,
    filePath: typeof input.filePath === "string" ? input.filePath : undefined,
    selectedOptionId: isSelectedOptionId(input.selectedOptionId) ? input.selectedOptionId : undefined,
    autoConfirmLightReview:
      typeof input.autoConfirmLightReview === "boolean" ? input.autoConfirmLightReview : undefined,
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
  };
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

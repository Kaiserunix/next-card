import { confirmFacts } from "@/lib/server/input-layer/fact-confirmation-service";
import type { ConfirmableFactField, MissingFactField } from "@/lib/server/input-layer/types";
import {
  JsonFileImportConfirmationSessionRepository,
  type ImportConfirmationSessionRepository,
} from "@/lib/server/import-review/confirmation-session-repository";
import type {
  ImportConfirmationCommand,
  ImportConfirmationCorrections,
  ImportConfirmationResult,
  ImportReviewConfirmationSession,
} from "@/lib/server/import-review/types";

export class ImportConfirmationError extends Error {
  constructor(
    public readonly code:
      | "INVALID_IMPORT_CONFIRMATION_REQUEST"
      | "IMPORT_REVIEW_SESSION_NOT_FOUND"
      | "IMPORT_REVIEW_SESSION_CLOSED"
      | "IMPORT_REVIEW_SESSION_EXPIRED"
      | "INVALID_IMPORT_CORRECTION",
    message: string,
    public readonly status = 400,
    public readonly recoverable = true,
  ) {
    super(message);
    this.name = "ImportConfirmationError";
  }
}

export type ImportConfirmationServiceOptions = {
  repository?: ImportConfirmationSessionRepository;
  now?: () => string;
};

const CONFIRMABLE_FIELDS = new Set<ConfirmableFactField>(["event", "time", "deadline", "location", "taskType", "lifecycle"]);
const MISSING_FIELDS = new Set<MissingFactField>(["event", "time", "deadline", "location", "taskType", "lifecycle"]);
const PROMPT_LIKE_CORRECTION = /(ignore previous instructions|system prompt|developer message|committedDeck|proofRecord|reminderJob|profileSnapshot|cardState|mark .*complete|标成完成|写入证明|删除提醒)/i;
type CorrectionField = "event" | "time" | "deadline" | "location" | "taskType" | "lifecycle";

export class ImportConfirmationService {
  private readonly repository: ImportConfirmationSessionRepository;
  private readonly now: () => string;

  constructor(options: ImportConfirmationServiceOptions = {}) {
    this.repository = options.repository ?? new JsonFileImportConfirmationSessionRepository();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async confirm(input: unknown): Promise<ImportConfirmationResult> {
    const command = validateImportConfirmationCommand(input);
    const session = await this.loadOpenSession(command.reviewSessionId);
    const now = command.clientContext?.now ?? this.now();

    if (command.action === "reject") {
      await this.repository.update({
        ...session,
        status: "rejected",
        closedAt: now,
      });
      return {
        status: "rejected",
        boundaryWarnings: boundaryWarnings(session),
        errors: [],
      };
    }

    const corrections = normalizeCorrections(session, command.corrections);
    const confirmation = confirmFacts({
      request: session.confirmationRequest,
      action: command.action,
      corrections,
      sourceType: session.sourceType,
      allowStrictReviewConfirmation: session.confirmationRequest.mode === "strict-review",
    });

    if (!confirmation.planCompilerHandoff || !confirmation.verifiedInputBundle) {
      throw new ImportConfirmationError(
        "INVALID_IMPORT_CORRECTION",
        "Confirmed review session is still not ready for Plan Mode handoff.",
        409,
        true,
      );
    }

    await this.repository.update({
      ...session,
      status: command.action === "correct" ? "corrected" : "confirmed",
      closedAt: now,
    });

    return {
      status: command.action === "correct" ? "corrected" : "confirmed",
      verifiedInputBundle: confirmation.verifiedInputBundle,
      planCompilerHandoff: confirmation.planCompilerHandoff,
      boundaryWarnings: boundaryWarnings(session),
      errors: [],
    };
  }

  private async loadOpenSession(id: string): Promise<ImportReviewConfirmationSession> {
    const session = await this.repository.get(id);
    if (!session) {
      throw new ImportConfirmationError("IMPORT_REVIEW_SESSION_NOT_FOUND", "Import review session was not found.", 404, true);
    }

    if (session.status !== "pending") {
      throw new ImportConfirmationError("IMPORT_REVIEW_SESSION_CLOSED", "Import review session is already closed.", 409, true);
    }

    if (Date.parse(session.expiresAt) <= Date.parse(this.now())) {
      await this.repository.update({ ...session, status: "expired", closedAt: this.now() });
      throw new ImportConfirmationError("IMPORT_REVIEW_SESSION_EXPIRED", "Import review session has expired.", 409, true);
    }

    return session;
  }
}

function validateImportConfirmationCommand(input: unknown): ImportConfirmationCommand {
  if (!isRecord(input)) {
    throw new ImportConfirmationError("INVALID_IMPORT_CONFIRMATION_REQUEST", "Import confirmation request must be a JSON object.");
  }

  if (typeof input.reviewSessionId !== "string" || !input.reviewSessionId.trim()) {
    throw new ImportConfirmationError("INVALID_IMPORT_CONFIRMATION_REQUEST", "reviewSessionId is required.");
  }

  if (input.action !== "confirm" && input.action !== "correct" && input.action !== "reject") {
    throw new ImportConfirmationError("INVALID_IMPORT_CONFIRMATION_REQUEST", "action must be confirm, correct, or reject.");
  }

  return {
    reviewSessionId: input.reviewSessionId,
    action: input.action,
    corrections: isRecord(input.corrections) ? readCorrections(input.corrections) : undefined,
    clientContext: isRecord(input.clientContext)
      ? {
          now: typeof input.clientContext.now === "string" ? input.clientContext.now : undefined,
          timezone: typeof input.clientContext.timezone === "string" ? input.clientContext.timezone : undefined,
          locale: input.clientContext.locale === "zh-CN" || input.clientContext.locale === "en" || input.clientContext.locale === "mixed" || input.clientContext.locale === "auto"
            ? input.clientContext.locale
            : undefined,
          anonymousDeviceId:
            typeof input.clientContext.anonymousDeviceId === "string" ? input.clientContext.anonymousDeviceId : undefined,
          userId: typeof input.clientContext.userId === "string" ? input.clientContext.userId : undefined,
        }
      : undefined,
  };
}

function readCorrections(input: Record<string, unknown>): ImportConfirmationCorrections {
  return {
    facts: Array.isArray(input.facts)
      ? input.facts.map((fact) => {
          if (!isRecord(fact) || typeof fact.factId !== "string" || typeof fact.value !== "string") {
            throw new ImportConfirmationError("INVALID_IMPORT_CONFIRMATION_REQUEST", "corrections.facts must contain factId and value.");
          }
          return { factId: fact.factId, value: fact.value };
        })
      : undefined,
    missingFacts: isRecord(input.missingFacts) ? readMissingFacts(input.missingFacts) : undefined,
  };
}

function readMissingFacts(input: Record<string, unknown>): ImportConfirmationCorrections["missingFacts"] {
  const result: NonNullable<ImportConfirmationCorrections["missingFacts"]> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!MISSING_FIELDS.has(key as MissingFactField)) {
      throw new ImportConfirmationError("INVALID_IMPORT_CONFIRMATION_REQUEST", `Unsupported missing fact field: ${key}.`);
    }
    if (typeof value === "string" && value.trim()) result[key as MissingFactField] = value.trim();
  }
  return result;
}

function normalizeCorrections(
  session: ImportReviewConfirmationSession,
  corrections: ImportConfirmationCorrections | undefined,
): Partial<Record<"event" | "time" | "deadline" | "location" | "taskType" | "lifecycle", string>> | undefined {
  if (!corrections) return undefined;

  const normalized: Partial<Record<"event" | "time" | "deadline" | "location" | "taskType" | "lifecycle", string>> = {};
  for (const factCorrection of corrections.facts ?? []) {
    const fact = session.confirmationRequest.facts.find((item) => item.id === factCorrection.factId);
    if (!fact) {
      throw new ImportConfirmationError("INVALID_IMPORT_CORRECTION", `Unknown factId: ${factCorrection.factId}.`);
    }
    if (!isCorrectionField(fact.field)) {
      throw new ImportConfirmationError("INVALID_IMPORT_CORRECTION", `Fact ${fact.id} cannot be corrected.`);
    }
    validateCorrectionValue(session, fact.field, factCorrection.value, fact.evidenceRefs.length);
    normalized[fact.field] = factCorrection.value.trim();
  }

  for (const [field, value] of Object.entries(corrections.missingFacts ?? {})) {
    if (!value) continue;
    validateCorrectionValue(session, field as ConfirmableFactField, value, 0);
    normalized[field as keyof typeof normalized] = value.trim();
  }

  return normalized;
}

function validateCorrectionValue(
  session: ImportReviewConfirmationSession,
  field: ConfirmableFactField,
  value: string,
  evidenceRefCount: number,
): void {
  if (!value.trim()) {
    throw new ImportConfirmationError("INVALID_IMPORT_CORRECTION", "Correction values cannot be empty.");
  }
  if (PROMPT_LIKE_CORRECTION.test(value)) {
    throw new ImportConfirmationError("INVALID_IMPORT_CORRECTION", "Prompt-like correction text cannot become a system instruction or proof write.");
  }
  if (
    session.reviewRequirement === "strict" &&
    (field === "time" || field === "deadline") &&
    evidenceRefCount === 0 &&
    session.confirmationRequest.facts.every((fact) => fact.field !== field || fact.evidenceRefs.length === 0)
  ) {
    throw new ImportConfirmationError(
      "INVALID_IMPORT_CORRECTION",
      "Strict review cannot turn an unevidenced source into a hard time lock or deadline.",
    );
  }
}

function isCorrectionField(field: ConfirmableFactField): field is CorrectionField {
  return CONFIRMABLE_FIELDS.has(field) && field !== "scope";
}

function boundaryWarnings(session: ImportReviewConfirmationSession): string[] {
  return [
    "input-layer-only: confirmation may produce verified bundle and PlanCompilerHandoff only",
    "must-generate-abc: confirmed imports still enter explicit A/B/C Plan Mode",
    "no-authoritative-runtime-writes: no deck, proof, reminder, profile, or card runtime writes",
    ...(session.reviewRequirement === "strict" ? ["strict-review-confirmed-by-user: source evidence is retained for later authority gates"] : []),
  ];
}

export function toImportConfirmationErrorResponse(error: unknown): Response {
  if (error instanceof ImportConfirmationError) {
    return Response.json(
      {
        error: error.code,
        recoverable: error.recoverable,
        message: sanitizeError(error),
      },
      { status: error.status },
    );
  }

  return Response.json(
    {
      error: "IMPORT_CONFIRMATION_FAILED",
      recoverable: true,
      message: "Import confirmation failed.",
    },
    { status: 500 },
  );
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/tp-[A-Za-z0-9._-]+/g, "tp-[redacted]")
    .replace(/data:[^"'\s]+/g, "data:[redacted]")
    .slice(0, 300);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

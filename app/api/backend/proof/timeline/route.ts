import { join } from "node:path";
import { JsonFileCardRuntimeRepository } from "@/lib/server/card-runtime/card-runtime-repository";
import { JsonFileDeckCommitRepository } from "@/lib/server/deck-commit/json-repositories";
import { JsonFileProofLedgerRepository } from "@/lib/server/proof-ledger/proof-ledger-repository";
import { projectProofTimeline } from "@/lib/server/proof-ledger/proof-timeline-projection";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sandboxRunId = readOptionalParam(url, "sandboxRunId");
    const paths = sandboxRunId ? sandboxPaths(sandboxRunId) : undefined;

    return Response.json(
      await projectProofTimeline({
        ledger: new JsonFileProofLedgerRepository(paths?.proofLedgerFile),
        deckRepository: new JsonFileDeckCommitRepository(
          paths
            ? {
                decksFile: paths.decksFile,
                cardsFile: paths.cardsFile,
                auditFile: paths.auditFile,
              }
            : undefined,
        ),
        runtimeRepository: new JsonFileCardRuntimeRepository(paths?.cardRuntimeFile),
        filters: {
          deckId: readOptionalParam(url, "deckId"),
          userId: readOptionalParam(url, "userId"),
          anonymousDeviceId: readOptionalParam(url, "anonymousDeviceId"),
          sandboxRunId,
        },
      }),
    );
  } catch (error) {
    return Response.json(
      {
        error: "PROOF_TIMELINE_READ_FAILED",
        message: error instanceof Error ? sanitizeError(error.message) : "Proof timeline read failed.",
        recoverable: true,
      },
      { status: error instanceof InvalidProofTimelineRequestError ? 400 : 500 },
    );
  }
}

export async function POST(): Promise<Response> {
  return Response.json(
    {
      error: "PROOF_TIMELINE_READONLY",
      message: "Proof Timeline is read-only.",
      recoverable: false,
    },
    { status: 405 },
  );
}

class InvalidProofTimelineRequestError extends Error {}

function readOptionalParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name);
  return value?.trim() || undefined;
}

function sandboxPaths(sandboxRunId: string) {
  if (!/^backend_run_[a-f0-9-]+$/i.test(sandboxRunId)) {
    throw new InvalidProofTimelineRequestError("sandboxRunId is invalid.");
  }
  const root = process.env.NEXTCARD_SANDBOX_RUN_DIR ?? join(process.cwd(), ".nextcard-data", "sandbox-runs");
  const runDir = join(root, sandboxRunId);
  return {
    proofLedgerFile: join(runDir, "proof-ledger.json"),
    decksFile: join(runDir, "decks.json"),
    cardsFile: join(runDir, "cards.json"),
    auditFile: join(runDir, "deck-commit-audit.json"),
    cardRuntimeFile: join(runDir, "card-runtime.json"),
  };
}

function sanitizeError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/tp-[A-Za-z0-9._-]+/g, "tp-[redacted]")
    .replace(/data:[^"'\s]+/g, "data:[redacted]")
    .slice(0, 300);
}

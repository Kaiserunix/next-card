import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ProofEvent, ProofEventRequest, ProofTimeline } from "@/lib/server/proof-ledger/types";
import { validateProofEventRequest } from "@/lib/server/proof-ledger/proof-event-validator";

export interface ProofLedgerRepository {
  appendEvent(request: ProofEventRequest, appendedAt?: string): Promise<ProofEvent>;
  listEvents(): Promise<ProofEvent[]>;
  getTimeline(): Promise<ProofTimeline>;
}

export function getProofLedgerFilePath(): string {
  return process.env.NEXTCARD_PROOF_LEDGER_FILE ?? join(process.cwd(), ".nextcard-data", "proof-ledger.json");
}

export class JsonFileProofLedgerRepository implements ProofLedgerRepository {
  constructor(private readonly filePath = getProofLedgerFilePath()) {}

  async appendEvent(request: ProofEventRequest, appendedAt = new Date().toISOString()): Promise<ProofEvent> {
    const events = await this.readAll();
    validateProofEventRequest(request);

    const existing = events.find((event) => event.id === request.id);
    if (existing) return existing;

    const event: ProofEvent = {
      ...request,
      ledgerSequence: events.length + 1,
      appendedAt,
    };

    events.push(event);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(events, null, 2)}\n`, "utf8");
    return event;
  }

  async listEvents(): Promise<ProofEvent[]> {
    return this.readAll();
  }

  async getTimeline(): Promise<ProofTimeline> {
    const events = await this.readAll();
    return {
      events: events.sort((left, right) => left.ledgerSequence - right.ledgerSequence),
    };
  }

  private async readAll(): Promise<ProofEvent[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as ProofEvent[]) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}

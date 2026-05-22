import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ProofEvent, ProofEventRequest, ProofOutboxRecord } from "@/lib/server/proof-ledger/types";
import { validateProofEventRequest } from "@/lib/server/proof-ledger/proof-event-validator";
import {
  JsonFileProofLedgerRepository,
  type ProofLedgerRepository,
} from "@/lib/server/proof-ledger/proof-ledger-repository";

export interface ProofOutboxRepository {
  saveRecord(record: ProofOutboxRecord): Promise<ProofOutboxRecord>;
  listRecords(): Promise<ProofOutboxRecord[]>;
  updateRecord(record: ProofOutboxRecord): Promise<ProofOutboxRecord>;
}

export type ProofOutboxProcessResult = {
  processed: ProofEvent[];
  failed: ProofOutboxRecord[];
};

export function getProofOutboxFilePath(): string {
  return process.env.NEXTCARD_PROOF_OUTBOX_FILE ?? join(process.cwd(), ".nextcard-data", "proof-outbox.json");
}

export class JsonFileProofOutboxRepository implements ProofOutboxRepository {
  constructor(private readonly filePath = getProofOutboxFilePath()) {}

  async saveRecord(record: ProofOutboxRecord): Promise<ProofOutboxRecord> {
    const records = await this.readAll();
    const index = records.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      records[index] = record;
    } else {
      records.push(record);
    }

    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
    return record;
  }

  async listRecords(): Promise<ProofOutboxRecord[]> {
    return this.readAll();
  }

  async updateRecord(record: ProofOutboxRecord): Promise<ProofOutboxRecord> {
    return this.saveRecord(record);
  }

  private async readAll(): Promise<ProofOutboxRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as ProofOutboxRecord[]) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}

export class ProofOutboxService {
  constructor(
    private readonly repository: ProofOutboxRepository = new JsonFileProofOutboxRepository(),
    private readonly ledger: ProofLedgerRepository = new JsonFileProofLedgerRepository(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async enqueue(request: ProofEventRequest): Promise<ProofOutboxRecord> {
    validateProofEventRequest(request);
    return this.repository.saveRecord({
      id: `outbox_${request.id}`,
      request,
      status: "pending",
      attempts: 0,
      createdAt: this.now(),
    });
  }

  async processPending(): Promise<ProofOutboxProcessResult> {
    const records = await this.repository.listRecords();
    const result: ProofOutboxProcessResult = { processed: [], failed: [] };

    for (const record of records.filter((item) => item.status === "pending")) {
      try {
        const event = await this.ledger.appendEvent(record.request, this.now());
        await this.repository.updateRecord({
          ...record,
          status: "processed",
          attempts: record.attempts + 1,
          processedAt: this.now(),
          error: undefined,
        });
        result.processed.push(event);
      } catch (error) {
        const failed = {
          ...record,
          status: "failed" as const,
          attempts: record.attempts + 1,
          error: error instanceof Error ? error.message : "Unknown proof ledger error.",
        };
        await this.repository.updateRecord(failed);
        result.failed.push(failed);
      }
    }

    return result;
  }
}

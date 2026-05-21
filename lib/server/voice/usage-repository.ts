import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { VoiceQuotaSubject, VoiceUsageRecord } from "@/lib/server/voice/types";

export interface VoiceUsageRepository {
  append(record: VoiceUsageRecord): Promise<void>;
  listForSubjectOnDay(subject: VoiceQuotaSubject, yyyyMmDd: string): Promise<VoiceUsageRecord[]>;
}

export class LocalJsonVoiceUsageRepository implements VoiceUsageRepository {
  constructor(private readonly filePath: string) {}

  async append(record: VoiceUsageRecord): Promise<void> {
    const records = await this.readAll();
    records.push(record);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }

  async listForSubjectOnDay(subject: VoiceQuotaSubject, yyyyMmDd: string): Promise<VoiceUsageRecord[]> {
    const records = await this.readAll();
    return records.filter((record) => {
      return (
        record.subject.kind === subject.kind &&
        record.subject.id === subject.id &&
        record.createdAt.startsWith(yyyyMmDd)
      );
    });
  }

  private async readAll(): Promise<VoiceUsageRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as VoiceUsageRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}

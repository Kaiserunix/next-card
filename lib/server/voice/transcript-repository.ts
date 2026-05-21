import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ConfirmedVoiceTranscriptRecord } from "@/lib/server/voice/types";

export interface VoiceTranscriptRepository {
  append(record: ConfirmedVoiceTranscriptRecord): Promise<void>;
  listForDevice(anonymousDeviceId: string): Promise<ConfirmedVoiceTranscriptRecord[]>;
}

export class LocalJsonVoiceTranscriptRepository implements VoiceTranscriptRepository {
  constructor(private readonly filePath: string) {}

  async append(record: ConfirmedVoiceTranscriptRecord): Promise<void> {
    const records = await this.readAll();
    records.push(record);
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }

  async listForDevice(anonymousDeviceId: string): Promise<ConfirmedVoiceTranscriptRecord[]> {
    const records = await this.readAll();
    return records.filter((record) => record.anonymousDeviceId === anonymousDeviceId);
  }

  private async readAll(): Promise<ConfirmedVoiceTranscriptRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as ConfirmedVoiceTranscriptRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}

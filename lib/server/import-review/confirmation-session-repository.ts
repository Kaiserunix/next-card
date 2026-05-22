import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ImportReviewConfirmationSession } from "@/lib/server/import-review/types";

export interface ImportConfirmationSessionRepository {
  save(session: ImportReviewConfirmationSession): Promise<ImportReviewConfirmationSession>;
  get(id: string): Promise<ImportReviewConfirmationSession | null>;
  update(session: ImportReviewConfirmationSession): Promise<ImportReviewConfirmationSession>;
}

export function getImportConfirmationSessionFilePath(): string {
  return process.env.NEXTCARD_IMPORT_REVIEW_SESSION_FILE ?? join(process.cwd(), ".nextcard-data", "import-review-sessions.json");
}

export class JsonFileImportConfirmationSessionRepository implements ImportConfirmationSessionRepository {
  constructor(private readonly filePath = getImportConfirmationSessionFilePath()) {}

  async save(session: ImportReviewConfirmationSession): Promise<ImportReviewConfirmationSession> {
    const sessions = await this.readAll();
    const index = sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    await writeArray(this.filePath, sessions);
    return session;
  }

  async get(id: string): Promise<ImportReviewConfirmationSession | null> {
    const sessions = await this.readAll();
    return sessions.find((session) => session.id === id) ?? null;
  }

  async update(session: ImportReviewConfirmationSession): Promise<ImportReviewConfirmationSession> {
    return this.save(session);
  }

  private async readAll(): Promise<ImportReviewConfirmationSession[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as ImportReviewConfirmationSession[]) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}

async function writeArray<T>(filePath: string, values: T[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(values, null, 2)}\n`, "utf8");
}

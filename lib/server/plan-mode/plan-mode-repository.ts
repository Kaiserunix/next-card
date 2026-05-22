import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PlanModeDraft } from "@/lib/server/plan-mode/types";

export interface PlanModeDraftRepository {
  saveDraft(draft: PlanModeDraft): Promise<PlanModeDraft>;
  getDraft(id: string): Promise<PlanModeDraft | null>;
  listDraftsByHandoff(verifiedInputBundleId: string): Promise<PlanModeDraft[]>;
}

export function getPlanModeDraftFilePath(): string {
  return process.env.NEXTCARD_PLAN_MODE_DRAFT_FILE ?? join(process.cwd(), ".nextcard-data", "plan-mode-drafts.json");
}

export class JsonFilePlanModeDraftRepository implements PlanModeDraftRepository {
  constructor(private readonly filePath = getPlanModeDraftFilePath()) {}

  async saveDraft(draft: PlanModeDraft): Promise<PlanModeDraft> {
    const drafts = await this.readAll();
    const existingIndex = drafts.findIndex((item) => item.id === draft.id);
    if (existingIndex >= 0) {
      drafts[existingIndex] = draft;
    } else {
      drafts.push(draft);
    }

    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(drafts, null, 2)}\n`, "utf8");
    return draft;
  }

  async getDraft(id: string): Promise<PlanModeDraft | null> {
    const drafts = await this.readAll();
    return drafts.find((draft) => draft.id === id) ?? null;
  }

  async listDraftsByHandoff(verifiedInputBundleId: string): Promise<PlanModeDraft[]> {
    const drafts = await this.readAll();
    return drafts
      .filter((draft) => draft.verifiedInputBundleId === verifiedInputBundleId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  private async readAll(): Promise<PlanModeDraft[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as PlanModeDraft[]) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}

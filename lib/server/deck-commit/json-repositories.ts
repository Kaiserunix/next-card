import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CommittedCard, CommittedDeck, DeckCommitAuditRecord } from "@/lib/server/deck-commit/types";

export interface DeckCommitRepository {
  saveDeck(deck: CommittedDeck): Promise<CommittedDeck>;
  saveCards(cards: CommittedCard[]): Promise<CommittedCard[]>;
  saveAudit(record: DeckCommitAuditRecord): Promise<DeckCommitAuditRecord>;
  findDeckByPlanModeDraft(planModeDraftId: string): Promise<CommittedDeck | null>;
  getDeck(deckId: string): Promise<CommittedDeck | null>;
  listCardsByDeck(deckId: string): Promise<CommittedCard[]>;
}

export type DeckCommitRepositoryPaths = {
  decksFile: string;
  cardsFile: string;
  auditFile: string;
};

export function getDeckCommitRepositoryPaths(): DeckCommitRepositoryPaths {
  return {
    decksFile: process.env.NEXTCARD_DECKS_FILE ?? join(process.cwd(), ".nextcard-data", "decks.json"),
    cardsFile: process.env.NEXTCARD_CARDS_FILE ?? join(process.cwd(), ".nextcard-data", "cards.json"),
    auditFile: process.env.NEXTCARD_DECK_COMMIT_AUDIT_FILE ?? join(process.cwd(), ".nextcard-data", "deck-commit-audit.json"),
  };
}

export class JsonFileDeckCommitRepository implements DeckCommitRepository {
  constructor(private readonly paths: DeckCommitRepositoryPaths = getDeckCommitRepositoryPaths()) {}

  async saveDeck(deck: CommittedDeck): Promise<CommittedDeck> {
    const decks = await readArray<CommittedDeck>(this.paths.decksFile);
    const index = decks.findIndex((item) => item.deckId === deck.deckId);
    if (index >= 0) {
      decks[index] = deck;
    } else {
      decks.push(deck);
    }
    await writeArray(this.paths.decksFile, decks);
    return deck;
  }

  async saveCards(cards: CommittedCard[]): Promise<CommittedCard[]> {
    const existing = await readArray<CommittedCard>(this.paths.cardsFile);
    const next = existing.filter((card) => !cards.some((item) => item.cardId === card.cardId));
    next.push(...cards);
    await writeArray(this.paths.cardsFile, next);
    return cards;
  }

  async saveAudit(record: DeckCommitAuditRecord): Promise<DeckCommitAuditRecord> {
    const records = await readArray<DeckCommitAuditRecord>(this.paths.auditFile);
    records.push(record);
    await writeArray(this.paths.auditFile, records);
    return record;
  }

  async findDeckByPlanModeDraft(planModeDraftId: string): Promise<CommittedDeck | null> {
    const decks = await readArray<CommittedDeck>(this.paths.decksFile);
    return decks.find((deck) => deck.planModeDraftId === planModeDraftId) ?? null;
  }

  async getDeck(deckId: string): Promise<CommittedDeck | null> {
    const decks = await readArray<CommittedDeck>(this.paths.decksFile);
    return decks.find((deck) => deck.deckId === deckId) ?? null;
  }

  async listCardsByDeck(deckId: string): Promise<CommittedCard[]> {
    const cards = await readArray<CommittedCard>(this.paths.cardsFile);
    return cards.filter((card) => card.deckId === deckId).sort((left, right) => left.sequence - right.sequence);
  }
}

async function readArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeArray<T>(filePath: string, values: T[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(values, null, 2)}\n`, "utf8");
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CardRuntimeEvent, CardRuntimeState } from "@/lib/server/card-runtime/types";

export interface CardRuntimeRepository {
  getState(deckId: string, cardId: string): Promise<CardRuntimeState | null>;
  saveState(state: CardRuntimeState): Promise<CardRuntimeState>;
  findEventByRequestId(requestId: string): Promise<CardRuntimeEvent | null>;
  saveEvent(event: CardRuntimeEvent): Promise<CardRuntimeEvent>;
  listStatesByDeck(deckId: string): Promise<CardRuntimeState[]>;
  listEvents(): Promise<CardRuntimeEvent[]>;
}

type CardRuntimeStore = {
  states: CardRuntimeState[];
  events: CardRuntimeEvent[];
};

export function getCardRuntimeFilePath(): string {
  return process.env.NEXTCARD_CARD_RUNTIME_FILE ?? join(process.cwd(), ".nextcard-data", "card-runtime.json");
}

export class JsonFileCardRuntimeRepository implements CardRuntimeRepository {
  constructor(private readonly filePath = getCardRuntimeFilePath()) {}

  async getState(deckId: string, cardId: string): Promise<CardRuntimeState | null> {
    const store = await this.readStore();
    return store.states.find((state) => state.deckId === deckId && state.cardId === cardId) ?? null;
  }

  async saveState(state: CardRuntimeState): Promise<CardRuntimeState> {
    const store = await this.readStore();
    const index = store.states.findIndex((item) => item.deckId === state.deckId && item.cardId === state.cardId);
    if (index >= 0) {
      store.states[index] = state;
    } else {
      store.states.push(state);
    }
    await this.writeStore(store);
    return state;
  }

  async findEventByRequestId(requestId: string): Promise<CardRuntimeEvent | null> {
    const store = await this.readStore();
    return store.events.find((event) => event.requestId === requestId) ?? null;
  }

  async saveEvent(event: CardRuntimeEvent): Promise<CardRuntimeEvent> {
    const store = await this.readStore();
    const index = store.events.findIndex((item) => item.requestId === event.requestId);
    if (index >= 0) {
      store.events[index] = event;
    } else {
      store.events.push(event);
    }
    await this.writeStore(store);
    return event;
  }

  async listStatesByDeck(deckId: string): Promise<CardRuntimeState[]> {
    const store = await this.readStore();
    return store.states.filter((state) => state.deckId === deckId);
  }

  async listEvents(): Promise<CardRuntimeEvent[]> {
    const store = await this.readStore();
    return store.events;
  }

  private async readStore(): Promise<CardRuntimeStore> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<CardRuntimeStore>;
      return {
        states: Array.isArray(parsed.states) ? parsed.states : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { states: [], events: [] };
      throw error;
    }
  }

  private async writeStore(store: CardRuntimeStore): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }
}

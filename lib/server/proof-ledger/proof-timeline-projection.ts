import type { DeckCommitRepository } from "@/lib/server/deck-commit/json-repositories";
import type { CardRuntimeRepository } from "@/lib/server/card-runtime/card-runtime-repository";
import type { ProofLedgerRepository } from "@/lib/server/proof-ledger/proof-ledger-repository";
import type {
  ProofEvent,
  ProofTimelineEntry,
  ProofTimelineProjectionResult,
  ProofTimelineSummary,
} from "@/lib/server/proof-ledger/types";

export type ProofTimelineProjectionFilters = {
  deckId?: string;
  userId?: string;
  anonymousDeviceId?: string;
  sandboxRunId?: string;
};

export type ProjectProofTimelineInput = {
  ledger: ProofLedgerRepository;
  deckRepository?: DeckCommitRepository;
  runtimeRepository?: CardRuntimeRepository;
  filters?: ProofTimelineProjectionFilters;
};

const SHAMING_OR_DIAGNOSTIC_COPY = /(懒|自律差|失败人格|失败者|废物|没救|lazy|failure tendency|personality score)/gi;

export async function projectProofTimeline(input: ProjectProofTimelineInput): Promise<ProofTimelineProjectionResult> {
  const events = (await input.ledger.listEvents()).sort((left, right) => left.ledgerSequence - right.ledgerSequence);
  const filtered = await filterEvents(events, input);
  const entries = filtered.map(toTimelineEntry).filter((entry): entry is ProofTimelineEntry => Boolean(entry));

  return {
    entries,
    summary: summarize(entries),
    boundaryWarnings: [
      "proof-timeline-readonly: this projection does not append or mutate proof",
      "neutral-copy-only: burn, freeze, and defer are status facts, not punishment",
      "authority-preserved: deck/card/runtime writes remain in their owning services",
    ],
  };
}

async function filterEvents(events: ProofEvent[], input: ProjectProofTimelineInput): Promise<ProofEvent[]> {
  const result: ProofEvent[] = [];

  for (const event of events) {
    if (input.filters?.deckId && event.deckId !== input.filters.deckId) continue;
    if (input.filters?.sandboxRunId && event.metadata?.sandboxRunId !== input.filters.sandboxRunId) {
      // Sandbox route-level stores are normally isolated by path; this metadata check is only for shared ledgers.
      if (event.metadata?.sandboxRunId) continue;
    }

    if ((input.filters?.userId || input.filters?.anonymousDeviceId) && event.deckId && input.deckRepository) {
      const deck = await input.deckRepository.getDeck(event.deckId);
      if (input.filters.userId && deck?.userId !== input.filters.userId) continue;
      if (input.filters.anonymousDeviceId && deck?.anonymousDeviceId !== input.filters.anonymousDeviceId) continue;
    }

    result.push(event);
  }

  return result;
}

function toTimelineEntry(event: ProofEvent): ProofTimelineEntry | null {
  const type = toTimelineType(event.type);
  if (!type) return null;

  return {
    id: `timeline_${event.ledgerSequence}_${event.id}`,
    occurredAt: event.createdAt,
    type,
    deckId: event.deckId,
    cardId: event.cardId,
    title: titleFor(type),
    statusColor: colorFor(type),
    userVisibleCopy: sanitizeVisibleCopy(event.summary),
    nextSuggestion: nextSuggestionFor(type),
    source: "proof-ledger",
  };
}

function toTimelineType(type: ProofEvent["type"]): ProofTimelineEntry["type"] | null {
  if (type === "deck_committed") return "deck_committed";
  if (type === "card_started") return "card_started";
  if (type === "card_completed") return "card_completed";
  if (type === "card_frozen") return "card_frozen";
  if (type === "burn_started") return "burn_started";
  if (type === "burn_completed") return "burn_completed";
  if (type === "card_deferred") return "card_deferred";
  if (type === "deadline_warning") return "deadline_warning";
  if (type === "reminder_created") return "reminder_created";
  return null;
}

function titleFor(type: ProofTimelineEntry["type"]): string {
  const titles: Record<ProofTimelineEntry["type"], string> = {
    deck_committed: "卡组已生成",
    card_started: "卡片开始",
    card_completed: "卡片完成",
    card_frozen: "卡片冻结",
    burn_started: "燃烧提醒开始",
    burn_completed: "燃烧提醒结束",
    card_deferred: "卡片已推迟",
    deadline_warning: "时间提醒",
    reminder_created: "提醒已记录",
  };
  return titles[type];
}

function colorFor(type: ProofTimelineEntry["type"]): ProofTimelineEntry["statusColor"] {
  if (type === "card_completed") return "green";
  if (type === "card_frozen") return "ice";
  if (type === "burn_started" || type === "burn_completed" || type === "card_deferred") return "orange";
  if (type === "deadline_warning") return "red";
  if (type === "reminder_created") return "gold";
  if (type === "card_started" || type === "deck_committed") return "blue";
  return "gray";
}

function nextSuggestionFor(type: ProofTimelineEntry["type"]): string | undefined {
  if (type === "card_completed") return "继续下一张卡，保持动作很小。";
  if (type === "card_frozen") return "稍后通过恢复窗口继续，不需要重建任务。";
  if (type === "burn_started" || type === "burn_completed") return "把燃烧当成时间提醒，可继续或重新安排。";
  if (type === "card_deferred") return "按新的时间窗口回到这张卡。";
  if (type === "deadline_warning") return "先确认硬时间，再决定是否缩小下一步。";
  return undefined;
}

function summarize(entries: ProofTimelineEntry[]): ProofTimelineSummary {
  return {
    totalEntries: entries.length,
    committedDecks: entries.filter((entry) => entry.type === "deck_committed").length,
    completedCards: new Set(entries.filter((entry) => entry.type === "card_completed").map((entry) => entry.cardId)).size,
    frozenCards: new Set(entries.filter((entry) => entry.type === "card_frozen").map((entry) => entry.cardId)).size,
    burningEvents: entries.filter((entry) => entry.type === "burn_started" || entry.type === "burn_completed").length,
    deferredCards: new Set(entries.filter((entry) => entry.type === "card_deferred").map((entry) => entry.cardId)).size,
    latestOccurredAt: entries.at(-1)?.occurredAt,
    nextSuggestion: entries.at(-1)?.nextSuggestion ?? "先选择一个已确认卡组，再推进一张卡。",
  };
}

function sanitizeVisibleCopy(copy: string): string {
  return copy.replace(SHAMING_OR_DIAGNOSTIC_COPY, "需要支持");
}

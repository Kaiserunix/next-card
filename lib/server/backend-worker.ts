import type {
  BackendWorkerSnapshot,
  BackendWorkerTickResult,
  FreezeReturnDecision,
  QueueAction,
  QueueItem,
  TaskCard
} from "@/lib/types";
import { runFreezeReturnSweep } from "@/lib/server/freeze-sweep";
import { createSchedulePlan } from "@/lib/server/schedule-planner";

export function runBackendWorkerTick(snapshot: BackendWorkerSnapshot): BackendWorkerTickResult {
  const schedule = createSchedulePlan({
    now: snapshot.now,
    items: [...snapshot.queueItems, ...snapshot.hiddenGoals],
    activeQueue: snapshot.activeQueue,
    timeLocks: snapshot.timeLocks,
    maxDealCards: 2
  });
  const freezeDecisions = runFreezeReturnSweep({
    now: snapshot.now,
    frozenTasks: snapshot.frozenTasks,
    currentQueue: snapshot.queueItems,
    timeLocks: snapshot.timeLocks
  });
  const allActions = [...schedule.actions, ...freezeDecisions.map((decision) => decision.action)];
  const skippedActionIds: string[] = [];
  const actions = allActions.filter((action) => {
    if (snapshot.processedActionIds.includes(action.id)) {
      skippedActionIds.push(action.id);
      return false;
    }

    return true;
  });

  return {
    tickId: `worker-${snapshot.now.replaceAll(":", "-").replaceAll(".", "-").replace("Z", "")}`,
    generatedAt: snapshot.now,
    actions: dedupeActions(actions),
    skippedActionIds,
    schedule,
    freezeDecisions
  };
}

export function applyBackendWorkerTick(
  snapshot: BackendWorkerSnapshot,
  result: BackendWorkerTickResult,
  processedActions: QueueAction[] = result.actions
): BackendWorkerSnapshot {
  let queueItems = [...snapshot.queueItems];
  let activeQueue = [...snapshot.activeQueue];
  let hiddenGoals = [...snapshot.hiddenGoals];
  let frozenTasks = [...snapshot.frozenTasks];

  for (const action of result.actions) {
    if (action.kind === "insert-task") {
      activeQueue = insertUnique(activeQueue, action.targetId, action.position);
      continue;
    }

    if (action.kind === "move-task") {
      activeQueue = moveExisting(activeQueue, action.targetId, action.position);
      continue;
    }

    if (action.kind === "deal-card") {
      activeQueue = insertUnique(activeQueue, action.targetId, action.position);
      queueItems = queueItems.map((item) =>
        item.id === action.targetId && item.status !== "completed" ? { ...item, status: "active" } : item
      );
      continue;
    }

    if (action.kind === "reveal-hidden-goal") {
      const hidden = hiddenGoals.find((item) => item.id === action.targetId);
      if (hidden) {
        hiddenGoals = hiddenGoals.filter((item) => item.id !== action.targetId);
        queueItems = upsertQueueItem(queueItems, {
          ...hidden,
          hidden: false,
          status: "needs-review"
        });
      }
      continue;
    }

    if (action.kind === "return-frozen-card" || action.kind === "split-frozen-card") {
      const decision = result.freezeDecisions.find((item) => item.action.id === action.id);
      if (decision?.restoredCard) {
        const entry = frozenTasks.find((item) => item.card.id === action.targetId);
        queueItems = upsertQueueItem(queueItems, restoredCardToQueueItem(decision.restoredCard, entry));
        activeQueue = insertUnique(activeQueue, action.targetId, action.position ?? 0);
        frozenTasks = frozenTasks.filter((item) => item.card.id !== action.targetId);
      }
    }
  }

  return {
    ...snapshot,
    queueItems,
    activeQueue,
    hiddenGoals,
    frozenTasks,
    processedActionIds: Array.from(new Set([...snapshot.processedActionIds, ...processedActions.map((action) => action.id)]))
  };
}

function dedupeActions(actions: QueueAction[]) {
  const seen = new Set<string>();

  return actions.filter((action) => {
    if (seen.has(action.id)) {
      return false;
    }

    seen.add(action.id);
    return true;
  });
}

function insertUnique(queue: string[], targetId: string, position = queue.length) {
  const withoutTarget = queue.filter((id) => id !== targetId);
  const safePosition = Math.max(0, Math.min(position, withoutTarget.length));
  return [...withoutTarget.slice(0, safePosition), targetId, ...withoutTarget.slice(safePosition)];
}

function moveExisting(queue: string[], targetId: string, position = queue.length) {
  return queue.includes(targetId) ? insertUnique(queue, targetId, position) : queue;
}

function upsertQueueItem(items: QueueItem[], item: QueueItem) {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    return [...items, item];
  }

  return items.map((existing) => (existing.id === item.id ? item : existing));
}

function restoredCardToQueueItem(card: TaskCard, entry?: BackendWorkerSnapshot["frozenTasks"][number]): QueueItem {
  return {
    id: card.id,
    title: card.title,
    kind: "card",
    status: "active",
    source: "text",
    createdAt: entry?.frozenAt ?? new Date().toISOString(),
    estimatedMinutes: card.estimatedMinutes,
    deadlineAt: card.deadlineAt,
    suggestedStartAt: card.suggestedStartAt,
    urgencyStage: card.urgencyStage,
    deckId: card.deckId,
    cardId: card.id,
    frozenAt: null,
    returnAfter: null,
    timeLocks: entry?.timeLocks ?? []
  };
}

export type { FreezeReturnDecision };

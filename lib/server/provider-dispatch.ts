import type { BackendPorts } from "@/lib/server/backend-ports";
import type { QueueAction } from "@/lib/types";

export type ProviderDispatchResult = {
  actionId: string;
  targetId: string;
  provider: "notification" | "calendar";
  status: "scheduled" | "updated" | "created" | "skipped" | "failed";
  providerId?: string;
  filePath?: string;
  error?: string;
};

export async function dispatchProviderActions(
  actions: QueueAction[],
  ports: Pick<BackendPorts, "notifications" | "calendar">,
  nowInput: string | Date = new Date()
): Promise<ProviderDispatchResult[]> {
  const results: ProviderDispatchResult[] = [];
  const now = typeof nowInput === "string" ? new Date(nowInput) : nowInput;

  for (const action of actions) {
    if (action.kind === "create-reminder" || action.kind === "update-reminder") {
      if (!isDue(action, now)) {
        continue;
      }
      results.push(await dispatchNotification(action, ports));
      continue;
    }

    if (action.kind === "create-calendar-event" || action.kind === "update-calendar-event") {
      results.push(await dispatchCalendar(action, ports));
    }
  }

  return results;
}

export function getProcessableProviderActions(actions: QueueAction[], nowInput: string | Date = new Date()) {
  const now = typeof nowInput === "string" ? new Date(nowInput) : nowInput;

  return actions.filter((action) => {
    if (action.kind === "create-reminder" || action.kind === "update-reminder") {
      return isDue(action, now);
    }

    return action.kind === "create-calendar-event" || action.kind === "update-calendar-event";
  });
}

function isDue(action: QueueAction, now: Date) {
  return !action.scheduledFor || new Date(action.scheduledFor).getTime() <= now.getTime();
}

async function dispatchNotification(action: QueueAction, ports: Pick<BackendPorts, "notifications">) {
  try {
    const result = await ports.notifications.createOrUpdate(action);
    return {
      actionId: action.id,
      targetId: action.targetId,
      provider: "notification" as const,
      status: result.status,
      providerId: result.providerId,
      error: result.error
    };
  } catch (error) {
    return {
      actionId: action.id,
      targetId: action.targetId,
      provider: "notification" as const,
      status: "failed" as const,
      error: error instanceof Error ? error.message : "Unknown notification provider error"
    };
  }
}

async function dispatchCalendar(action: QueueAction, ports: Pick<BackendPorts, "calendar">) {
  try {
    const result = await ports.calendar.createOrUpdate(action);
    return {
      actionId: action.id,
      targetId: action.targetId,
      provider: "calendar" as const,
      status: result.status,
      providerId: result.providerId,
      filePath: result.filePath,
      error: result.error
    };
  } catch (error) {
    return {
      actionId: action.id,
      targetId: action.targetId,
      provider: "calendar" as const,
      status: "failed" as const,
      error: error instanceof Error ? error.message : "Unknown calendar provider error"
    };
  }
}

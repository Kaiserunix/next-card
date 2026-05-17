import { NextResponse } from "next/server";
import { backendPorts } from "@/lib/server/backend-services";
import { applyBackendWorkerTick } from "@/lib/server/backend-worker";
import { readJsonWithLimit, requireInternalRequest } from "@/lib/server/http-guards";
import { dispatchProviderActions, getProcessableProviderActions } from "@/lib/server/provider-dispatch";
import type { BackendWorkerSnapshot } from "@/lib/types";

export const runtime = "nodejs";

type WorkerTickBody = Partial<BackendWorkerSnapshot> & {
  dryRun?: boolean;
  dispatchProviders?: boolean;
};

export async function POST(request: Request) {
  const unauthorized = requireInternalRequest(request, "Worker tick API");
  if (unauthorized) {
    return unauthorized;
  }

  const parsed = await readJsonWithLimit<WorkerTickBody>(request, { label: "worker tick", maxBytes: 256_000 });
  if (parsed.error) {
    return parsed.error;
  }

  const body = parsed.value;
  const requestBody = body ?? {};
  const now = requestBody.now ?? new Date().toISOString();
  const requestQueueItems = requestBody.queueItems;
  const usesRequestSnapshot = Array.isArray(requestQueueItems);

  if (usesRequestSnapshot && requestBody.dryRun !== true) {
    return NextResponse.json(
      { error: "Request snapshots are allowed only with dryRun: true and are never persisted." },
      { status: 400 }
    );
  }

  const snapshot = usesRequestSnapshot
    ? ({
        now,
        queueItems: requestQueueItems,
        activeQueue: requestBody.activeQueue ?? [],
        timeLocks: requestBody.timeLocks ?? [],
        frozenTasks: requestBody.frozenTasks ?? [],
        hiddenGoals: requestBody.hiddenGoals ?? [],
        processedActionIds: requestBody.processedActionIds ?? []
      } satisfies BackendWorkerSnapshot)
    : await backendPorts.queueRepository.readSnapshot(now);
  const result = await backendPorts.worker.tick(snapshot);
  const processableProviderActions = getProcessableProviderActions(result.actions, now);
  const dispatchResults =
    requestBody.dispatchProviders === false ? [] : await dispatchProviderActions(processableProviderActions, backendPorts, now);
  const processedActions = result.actions.filter(
    (action) =>
      (action.kind !== "create-reminder" &&
        action.kind !== "update-reminder") ||
      processableProviderActions.some((providerAction) => providerAction.id === action.id)
  );
  const nextSnapshot = applyBackendWorkerTick(snapshot, result, processedActions);

  if (requestBody.dryRun !== true) {
    await backendPorts.queueRepository.writeSnapshot(nextSnapshot);
  }

  return NextResponse.json({
    ...result,
    dispatchResults,
    persisted: requestBody.dryRun !== true,
    nextSnapshot: requestBody.dryRun === true ? nextSnapshot : undefined
  });
}

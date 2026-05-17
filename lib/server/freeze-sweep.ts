import type { FreezeReturnDecision, FrozenTaskEntry, QueueItem, TimeLock } from "@/lib/types";
import { analyzeFrozenTaskReturn } from "@/lib/server/freeze-return-agent";

export function runFreezeReturnSweep(input: {
  now: string;
  frozenTasks: FrozenTaskEntry[];
  currentQueue: QueueItem[];
  timeLocks?: TimeLock[];
}): FreezeReturnDecision[] {
  return input.frozenTasks.map((entry) =>
    analyzeFrozenTaskReturn({
      now: input.now,
      entry,
      currentQueue: input.currentQueue,
      timeLocks: input.timeLocks ?? []
    })
  );
}

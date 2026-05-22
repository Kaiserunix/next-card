import { createHash } from "node:crypto";

import type { FrozenQueueItem, ScheduleSnapshot, ScheduledCardRef, ScheduledDeckRef, ScheduledEvent, TimeLock, TimeWindow } from "./types";

export type BuildScheduleSnapshotInput = {
  now: string;
  timezone: string;
  committedDecks: ScheduledDeckRef[];
  activeCards: ScheduledCardRef[];
  scheduledEvents: ScheduledEvent[];
  timeLocks: TimeLock[];
  availableWindows: TimeWindow[];
  frozenQueue: FrozenQueueItem[];
  policySnapshotId?: string;
};

export type BuildScheduleSnapshotResult = {
  snapshot: ScheduleSnapshot;
};

export function buildScheduleSnapshot(input: BuildScheduleSnapshotInput): BuildScheduleSnapshotResult {
  const stablePayload = stableStringify({
    ...input,
    version: 1,
  });
  const digest = createHash("sha256").update(stablePayload).digest("hex").slice(0, 16);

  return {
    snapshot: {
      id: `snapshot_${digest}`,
      version: 1,
      ...input,
    },
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

import type {
  ProfileDimension,
  ProfileSnapshot,
  ProofSignalAggregate,
  RhythmWindowDays,
} from "./types";

type AggregateProfileOptions = {
  personalizationEnabled?: boolean;
  autoUpdateEnabled?: boolean;
  now?: string;
  evidenceWindowDays?: RhythmWindowDays;
};

export function buildDefaultProfile(userId: string, now = new Date().toISOString()): ProfileSnapshot {
  return {
    id: `profile_${userId}_default_v1`,
    userId,
    version: 1,
    createdAt: now,
    evidenceWindowDays: 14,
    confidence: 0,
    mode: "default",
    dimensions: {
      activationSupportLevel: unknownDimension(now),
      timeEstimateCalibration: unknownDimension(now),
      progressRhythm: unknownDimension(now),
      reminderPressureFit: unknownDimension(now),
    },
    evidenceIds: [],
    userEditable: true,
    resettable: true,
  };
}

export function aggregateProfile(
  aggregate: ProofSignalAggregate,
  previousProfile: ProfileSnapshot | null,
  options: AggregateProfileOptions = {},
): ProfileSnapshot {
  const previous = previousProfile ?? buildDefaultProfile(aggregate.userId, options.now ?? aggregate.createdAt);
  if (!options.personalizationEnabled || !options.autoUpdateEnabled) return previous;

  const now = options.now ?? new Date().toISOString();
  const confidence = Math.min(0.75, aggregate.dataQuality.evidenceCount / 12);
  const evidenceCount = aggregate.dataQuality.evidenceCount;

  return {
    ...previous,
    id: `profile_${aggregate.userId}_candidate_v${previous.version + 1}`,
    version: previous.version + 1,
    createdAt: now,
    evidenceWindowDays: options.evidenceWindowDays ?? aggregate.windowDays,
    confidence,
    mode: "candidate",
    dimensions: {
      activationSupportLevel: dimensionFromSignal(
        aggregate.signals.firstCardStartDelayMinutes,
        evidenceCount,
        now,
        (value) => (value >= 15 ? "high" : value <= 5 ? "low" : "medium"),
      ),
      timeEstimateCalibration: dimensionFromSignal(
        aggregate.signals.actualVsEstimatedRatio,
        evidenceCount,
        now,
        (value) => (value >= 1.25 ? "high" : value <= 0.85 ? "low" : "medium"),
      ),
      progressRhythm: dimensionFromSignal(
        aggregate.signals.freezeRate,
        evidenceCount,
        now,
        (value) => (value >= 0.35 ? "high" : value <= 0.1 ? "low" : "medium"),
      ),
      reminderPressureFit: dimensionFromSignal(
        aggregate.signals.deliveredReminderResponseRate ?? aggregate.signals.burnCompletionRate,
        evidenceCount,
        now,
        (value) => (value >= 0.7 ? "high" : value <= 0.25 ? "low" : "medium"),
      ),
    },
    evidenceIds: aggregate.evidenceEventIds,
    userEditable: true,
    resettable: true,
  };
}

export function unknownDimension(now: string): ProfileDimension {
  return {
    value: "unknown",
    confidence: 0,
    evidenceCount: 0,
    lastUpdatedAt: now,
  };
}

function dimensionFromSignal(
  signal: number | undefined,
  evidenceCount: number,
  now: string,
  classify: (value: number) => ProfileDimension["value"],
): ProfileDimension {
  if (signal === undefined) return unknownDimension(now);
  return {
    value: classify(signal),
    confidence: Math.min(0.75, evidenceCount / 12),
    evidenceCount,
    lastUpdatedAt: now,
  };
}

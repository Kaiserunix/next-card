import { aggregateProfile, buildDefaultProfile } from "./profile-aggregator";
import type { ProfileGovernanceSettings, ProfileSnapshot, ProofSignalAggregate, RhythmWindowDays } from "./types";

type EnableOptions = {
  autoUpdateEnabled?: boolean;
  evidenceWindowDays?: RhythmWindowDays;
  minimumEvidenceCount?: number;
  minimumConfidence?: number;
  experimentFlags?: string[];
  now?: string;
};

export function buildDefaultGovernanceSettings(
  userId: string,
  now = new Date().toISOString(),
): ProfileGovernanceSettings {
  return {
    userId,
    personalizationEnabled: false,
    autoUpdateEnabled: false,
    evidenceWindowDays: 14,
    minimumEvidenceCount: 3,
    minimumConfidence: 0.6,
    experimentFlags: [],
    updatedAt: now,
  };
}

export function enablePersonalization(
  settings: ProfileGovernanceSettings,
  options: EnableOptions = {},
): ProfileGovernanceSettings {
  return {
    ...settings,
    personalizationEnabled: true,
    autoUpdateEnabled: options.autoUpdateEnabled ?? settings.autoUpdateEnabled,
    evidenceWindowDays: options.evidenceWindowDays ?? settings.evidenceWindowDays,
    minimumEvidenceCount: options.minimumEvidenceCount ?? settings.minimumEvidenceCount,
    minimumConfidence: options.minimumConfidence ?? settings.minimumConfidence,
    experimentFlags: options.experimentFlags ?? settings.experimentFlags,
    updatedAt: options.now ?? new Date().toISOString(),
  };
}

export function disablePersonalization(
  settings: ProfileGovernanceSettings,
  now = new Date().toISOString(),
): ProfileGovernanceSettings {
  return {
    ...settings,
    personalizationEnabled: false,
    autoUpdateEnabled: false,
    updatedAt: now,
  };
}

export function resetProfile(
  userId: string,
  previousProfile: ProfileSnapshot | null,
  now = new Date().toISOString(),
): ProfileSnapshot {
  const previousVersion = previousProfile?.version ?? 0;
  return {
    ...buildDefaultProfile(userId, now),
    id: `profile_${userId}_reset_v${previousVersion + 1}`,
    version: previousVersion + 1,
  };
}

export function createProfileCandidate(
  settings: ProfileGovernanceSettings,
  aggregate: ProofSignalAggregate,
  previousProfile: ProfileSnapshot,
  now = new Date().toISOString(),
): ProfileSnapshot {
  if (!settings.personalizationEnabled || !settings.autoUpdateEnabled) {
    return previousProfile;
  }

  const candidate = aggregateProfile(aggregate, previousProfile, {
    personalizationEnabled: true,
    autoUpdateEnabled: true,
    now,
    evidenceWindowDays: settings.evidenceWindowDays,
  });

  return {
    ...candidate,
    mode: "candidate",
  };
}

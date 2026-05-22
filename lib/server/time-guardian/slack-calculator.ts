import { maxIso, minIso, minutesBetween, rangesOverlap } from "./time-overlap";

export type FixedBusyWindow = {
  startsAt: string;
  endsAt: string;
};

export type DeadlineSlackInput = {
  now: string;
  dueAt: string;
  remainingEstimatedMinutes: number;
  fixedBusyWindows: FixedBusyWindow[];
  safetyBufferMinutes: number;
};

export type DeadlineSlackResult = {
  totalMinutesUntilDue: number;
  fixedBusyMinutes: number;
  availableMinutes: number;
  slackMinutes: number;
};

export function calculateDeadlineSlackMinutes(input: DeadlineSlackInput): DeadlineSlackResult {
  const totalMinutesUntilDue = minutesBetween(input.now, input.dueAt);
  const fixedBusyMinutes = input.fixedBusyWindows.reduce((total, window) => {
    if (!rangesOverlap(input.now, input.dueAt, window.startsAt, window.endsAt)) return total;
    const overlapStart = maxIso(input.now, window.startsAt);
    const overlapEnd = minIso(input.dueAt, window.endsAt);
    return total + minutesBetween(overlapStart, overlapEnd);
  }, 0);
  const availableMinutes = Math.max(0, totalMinutesUntilDue - fixedBusyMinutes - input.safetyBufferMinutes);

  return {
    totalMinutesUntilDue,
    fixedBusyMinutes,
    availableMinutes,
    slackMinutes: availableMinutes - input.remainingEstimatedMinutes,
  };
}

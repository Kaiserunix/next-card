import { compareIso, rangesOverlap } from "./time-overlap";
import type { ScheduleSnapshot, TimeLock, TimeLockKind } from "./types";

export type TimeLockValidationResult =
  | { allowed: true; reason: string }
  | {
      allowed: false;
      reason: string;
      conflictLockIds: string[];
      requiresUserReview: boolean;
    };

export type ValidateScheduleWindowInput = {
  snapshot: ScheduleSnapshot;
  window: {
    startsAt: string;
    endsAt: string;
  };
  deadlineAt?: string;
};

export function validateScheduleWindowAgainstTimeLocks(input: ValidateScheduleWindowInput): TimeLockValidationResult {
  const conflicts: TimeLock[] = [];

  for (const lock of input.snapshot.timeLocks) {
    if (lock.startAt && lock.endAt && rangesOverlap(input.window.startsAt, input.window.endsAt, lock.startAt, lock.endAt)) {
      conflicts.push(lock);
    }
  }

  const deadlineExceeded = Boolean(input.deadlineAt && compareIso(input.window.endsAt, input.deadlineAt) > 0);
  if (deadlineExceeded) {
    conflicts.push(
      ...input.snapshot.timeLocks.filter((lock) => {
        return lock.kind === "submission_deadline" && lock.dueAt === input.deadlineAt;
      }),
    );
  }

  if (conflicts.length > 0 || deadlineExceeded) {
    const kinds = [
      ...new Set([
        ...conflicts.map((lock) => lock.kind),
        ...(deadlineExceeded ? (["submission_deadline"] as TimeLockKind[]) : []),
      ]),
    ].join(", ");
    return {
      allowed: false,
      reason: `Requested schedule window conflicts with protected time lock: ${kinds}.`,
      conflictLockIds: [...new Set(conflicts.map((lock) => lock.id))],
      requiresUserReview: true,
    };
  }

  return {
    allowed: true,
    reason: "Schedule window does not conflict with protected hard time.",
  };
}

export function validateTimeLockMove(input: {
  existingLock: TimeLock;
  proposedStartAt?: string;
  proposedEndAt?: string;
  proposedDueAt?: string;
}): TimeLockValidationResult {
  if (!input.existingLock.movable) {
    return {
      allowed: false,
      reason: `${input.existingLock.kind} is an immovable TimeLock and cannot be moved silently.`,
      conflictLockIds: [input.existingLock.id],
      requiresUserReview: true,
    };
  }

  return {
    allowed: true,
    reason: "TimeLock is movable.",
  };
}

export function validateNewTimeLockAuthority(input: {
  kind: TimeLockKind;
  reviewStatus: "verified" | "user-confirmed" | "unverified";
  sourceType: "user" | "ocr" | "pdf" | "notification" | "calendar";
  sourceRefs: unknown[];
}): TimeLockValidationResult {
  if (input.reviewStatus === "unverified" || input.sourceRefs.length === 0) {
    return {
      allowed: false,
      reason: `Cannot create ${input.kind} TimeLock from unverified ${input.sourceType} evidence.`,
      conflictLockIds: [],
      requiresUserReview: true,
    };
  }

  return {
    allowed: true,
    reason: "TimeLock has verified or user-confirmed source evidence.",
  };
}

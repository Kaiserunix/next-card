import { describe, expect, it } from "vitest";

import {
  validateNewTimeLockAuthority,
  validateScheduleWindowAgainstTimeLocks,
  validateTimeLockMove,
} from "@/lib/server/time-guardian/time-lock-validator";
import { classLock, lockedBlock, snapshot, submissionDeadline } from "./test-utils";

describe("time lock validator", () => {
  it("rejects card windows that overlap verified class time", () => {
    const result = validateScheduleWindowAgainstTimeLocks({
      snapshot: snapshot(),
      window: {
        startsAt: "2026-05-21T08:20:00+08:00",
        endsAt: "2026-05-21T08:40:00+08:00",
      },
    });

    expect(result).toMatchObject({
      allowed: false,
      conflictLockIds: ["lock_class_8am"],
      requiresUserReview: true,
    });
    expect(result.reason).toContain("class_time");
  });

  it("rejects defers that finish after a submission deadline", () => {
    const result = validateScheduleWindowAgainstTimeLocks({
      snapshot: snapshot({ timeLocks: [submissionDeadline()] }),
      window: {
        startsAt: "2026-05-21T20:30:00+08:00",
        endsAt: "2026-05-21T20:45:00+08:00",
      },
      deadlineAt: "2026-05-21T20:00:00+08:00",
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.conflictLockIds).toContain("lock_assignment_due");
    }
  });

  it("does not apply an unrelated submission deadline to cards without that deadline", () => {
    const result = validateScheduleWindowAgainstTimeLocks({
      snapshot: snapshot({ timeLocks: [submissionDeadline()] }),
      window: {
        startsAt: "2026-05-22T18:40:00+08:00",
        endsAt: "2026-05-22T18:55:00+08:00",
      },
    });

    expect(result.allowed).toBe(true);
  });

  it("rejects automatic insertion into user locked blocks", () => {
    const result = validateScheduleWindowAgainstTimeLocks({
      snapshot: snapshot({ timeLocks: [lockedBlock()] }),
      window: {
        startsAt: "2026-05-21T12:15:00+08:00",
        endsAt: "2026-05-21T12:35:00+08:00",
      },
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.conflictLockIds).toEqual(["lock_lunch"]);
    }
  });

  it("does not allow moving an immovable time lock", () => {
    const result = validateTimeLockMove({
      existingLock: classLock(),
      proposedStartAt: "2026-05-21T08:30:00+08:00",
      proposedEndAt: "2026-05-21T10:00:00+08:00",
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.requiresUserReview).toBe(true);
    }
  });

  it("does not accept unverified OCR as hard lock authority", () => {
    const result = validateNewTimeLockAuthority({
      kind: "class_time",
      reviewStatus: "unverified",
      sourceType: "ocr",
      sourceRefs: [],
    });

    expect(result.allowed).toBe(false);
  });
});

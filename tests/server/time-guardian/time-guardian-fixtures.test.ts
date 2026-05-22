import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { QueueAction, ReminderPlan, ScheduledEvent, TimeLock } from "@/lib/server/time-guardian/types";

const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "time-guardian");

const expectedFixtures = [
  "verified-class-8am.json",
  "assignment-deadline-tonight.json",
  "chosen-plan-c-only.json",
  "soft-task-before-good-line.json",
  "soft-task-after-hardens-at.json",
  "frozen-card-awaiting-return.json",
  "notification-permission-denied.json",
  "conflict-with-user-locked-block.json",
  "failed-reminder-delivery.json",
  "unverified-ocr-class-time.json",
];

const forbiddenTimeGuardianOutputs = new Set(["proofRecord", "profileSnapshot", "externalCalendarEvent"]);

describe("time guardian fixtures and contracts", () => {
  it("contains every required fixture", async () => {
    const files = await readdir(FIXTURE_DIR);
    expect(files.sort()).toEqual(expectedFixtures.sort());
  });

  it("keeps hard locks immovable and rejects unverified OCR as hard lock authority", async () => {
    const files = await readdir(FIXTURE_DIR);

    for (const file of files) {
      const fixture = JSON.parse(await readFile(join(FIXTURE_DIR, file), "utf8")) as Record<string, unknown>;
      expectForbiddenKeysAbsent(fixture);

      const timeLocks = ((fixture.scheduleSnapshot as Record<string, unknown>).timeLocks ?? []) as TimeLock[];
      for (const lock of timeLocks) {
        expect(lock.movable).toBe(false);
        expect(["verified", "user-confirmed"]).toContain(lock.reviewStatus);
      }

      if (file === "unverified-ocr-class-time.json") {
        expect(timeLocks).toHaveLength(0);
        expect(fixture).toHaveProperty("unverifiedTimeCandidate");
      }
    }
  });

  it("models scheduled events as internal events and queue actions as validated mutation requests", async () => {
    const files = await readdir(FIXTURE_DIR);

    for (const file of files) {
      const fixture = JSON.parse(await readFile(join(FIXTURE_DIR, file), "utf8")) as Record<string, unknown>;
      const actions = (fixture.queueActions ?? []) as QueueAction[];
      const events = ((fixture.scheduleSnapshot as Record<string, unknown>).scheduledEvents ?? []) as ScheduledEvent[];

      for (const action of actions) {
        expect(action.snapshotId).toEqual(expect.any(String));
        expect(action.actor).toMatch(/^(system-service|model-proposal|user)$/);
        expect(action.reason.trim().length).toBeGreaterThan(0);
        expect(action.createdAt).toEqual(expect.any(String));
      }

      for (const event of events) {
        expect(event.source).not.toBe("external-calendar");
        expect(event.basedOnSnapshotId).toEqual((fixture.scheduleSnapshot as Record<string, unknown>).id);
      }
    }
  });

  it("keeps baseline reminders system controlled and permission downgrade honest", async () => {
    const deniedFixture = JSON.parse(
      await readFile(join(FIXTURE_DIR, "notification-permission-denied.json"), "utf8"),
    ) as Record<string, unknown>;
    const reminderPlans = (deniedFixture.reminderPlans ?? []) as ReminderPlan[];

    expect(deniedFixture.notificationCapability).toBe("external_denied");
    expect(deniedFixture).not.toHaveProperty("externalNotificationJobs");
    expect(reminderPlans.some((plan) => plan.kind === "in-app-only")).toBe(true);

    for (const plan of reminderPlans) {
      if (plan.kind === "baseline") {
        expect(["system-fallback", "user-fixed"]).toContain(plan.source);
      }
    }
  });
});

function expectForbiddenKeysAbsent(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectForbiddenKeysAbsent);
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    expect(forbiddenTimeGuardianOutputs.has(key)).toBe(false);
    expectForbiddenKeysAbsent(nested);
  }
}

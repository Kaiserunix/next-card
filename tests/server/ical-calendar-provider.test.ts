import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIcsCalendarProvider } from "@/lib/server/providers/ics-calendar-provider";
import type { QueueAction } from "@/lib/types";

const outputDir = join(tmpdir(), "next-card-provider-tests", `calendar-${process.pid}`);
const now = "2026-05-17T10:00:00.000Z";

function action(overrides: Partial<QueueAction> = {}): QueueAction {
  return {
    id: overrides.id ?? "create-calendar-event:card-1:2026",
    kind: overrides.kind ?? "create-calendar-event",
    targetId: overrides.targetId ?? "card-1",
    title: overrides.title ?? "高数课",
    priority: overrides.priority ?? 88,
    scheduledFor: overrides.scheduledFor ?? "2026-05-17T10:30:00.000Z",
    payload: overrides.payload,
    reason: overrides.reason ?? "同步到日历。",
    confidence: 0.86,
    requiresUserReview: false,
    respectsLocks: true,
    createdAt: now
  };
}

describe("IcsCalendarProvider", () => {
  beforeEach(async () => {
    await rm(outputDir, { force: true, recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(outputDir, { force: true, recursive: true });
  });

  it("writes a real iCalendar event for calendar actions", async () => {
    const provider = createIcsCalendarProvider({
      outputDir,
      productId: "next-card/test",
      calendarName: "Next Card",
      defaultDurationMinutes: 25
    });

    const result = await provider.createOrUpdate(
      action({
        payload: {
          location: "二教 304",
          description: "来自 Next Card 的发牌动作。",
          reminderMinutesBefore: 10
        }
      })
    );

    expect(result).toMatchObject({
      providerId: "ics:card-1",
      status: "created"
    });
    expect(result.filePath).toMatch(/card-1\.ics$/);
    const ics = await readFile(result.filePath ?? "", "utf8");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:高数课");
    expect(ics).toContain("LOCATION:二教 304");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("UID:card-1@next-card.local");
  });

  it("updates an existing calendar event by writing the same deterministic file", async () => {
    const provider = createIcsCalendarProvider({ outputDir });
    const created = await provider.createOrUpdate(action());
    const updated = await provider.createOrUpdate(action({ kind: "update-calendar-event", title: "高数课改到 302" }));

    expect(updated.status).toBe("updated");
    expect(updated.filePath).toBe(created.filePath);
    const ics = await readFile(updated.filePath ?? "", "utf8");
    expect(ics).toContain("SUMMARY:高数课改到 302");
  });

  it("skips non-calendar actions", async () => {
    const provider = createIcsCalendarProvider({ outputDir });
    const result = await provider.createOrUpdate(action({ kind: "create-reminder" }));

    expect(result.status).toBe("skipped");
    expect(result.filePath).toBeUndefined();
  });
});

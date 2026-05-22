import { describe, expect, it } from "vitest";

import {
  classifyReminderDeliveryFailure,
  planReminderDelivery,
} from "@/lib/server/time-guardian/reminder-plan-service";

describe("reminder plan service", () => {
  it("downgrades denied notifications to in-app-only state without external jobs", () => {
    const result = planReminderDelivery({
      reminder: {
        id: "baseline_1",
        cardId: "card_prepare",
        deckId: "deck_calculus",
        chosenPlanId: "plan-b",
        fireAt: "2026-05-20T23:30:00.000Z",
        kind: "baseline",
        source: "system-fallback",
        capabilityRequired: "browser-notification",
        deliveryStatus: "planned",
        privacyLevel: "low-sensitive",
      },
      capability: "external_denied",
    });

    expect(result.reminder.kind).toBe("in-app-only");
    expect(result.externalJob).toBeNull();
    expect(result.userVisibleCopy).toContain("in-app");
  });

  it("does not count delivery failure as user ignoring the reminder", () => {
    expect(classifyReminderDeliveryFailure({ reminderId: "reminder_1", deliveryStatus: "failed" })).toMatchObject({
      countsAsUserIgnored: false,
    });
  });
});

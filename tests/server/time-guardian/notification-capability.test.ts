import { describe, expect, it } from "vitest";

import {
  canScheduleExternalReminder,
  describeNotificationCapability,
} from "@/lib/server/time-guardian/notification-capability";

describe("notification capability", () => {
  it("only allows external scheduling when permission is granted", () => {
    expect(canScheduleExternalReminder("external_granted")).toBe(true);
    expect(canScheduleExternalReminder("external_denied")).toBe(false);
    expect(canScheduleExternalReminder("unknown")).toBe(false);
  });

  it("uses honest copy when reminders are in-app only", () => {
    const decision = describeNotificationCapability("external_denied");

    expect(decision.mode).toBe("in-app-only");
    expect(decision.userVisibleCopy).toContain("in-app");
    expect(decision.mayCreateExternalJob).toBe(false);
  });
});

import { describeNotificationCapability } from "./notification-capability";
import type { NotificationCapability, ReminderPlan } from "./types";

export type ReminderDeliveryPlan = {
  reminder: ReminderPlan;
  externalJob: { reminderId: string; fireAt: string; privacyLevel: ReminderPlan["privacyLevel"] } | null;
  userVisibleCopy: string;
};

export function planReminderDelivery(input: {
  reminder: ReminderPlan;
  capability: NotificationCapability;
}): ReminderDeliveryPlan {
  const capability = describeNotificationCapability(input.capability);

  if (input.reminder.capabilityRequired === "none" || capability.mayCreateExternalJob) {
    return {
      reminder: input.reminder,
      externalJob:
        input.reminder.capabilityRequired === "none"
          ? null
          : {
              reminderId: input.reminder.id,
              fireAt: input.reminder.fireAt,
              privacyLevel: input.reminder.privacyLevel,
            },
      userVisibleCopy: capability.userVisibleCopy,
    };
  }

  return {
    reminder: {
      ...input.reminder,
      id: `${input.reminder.id}_in_app`,
      kind: "in-app-only",
      capabilityRequired: "none",
      userVisibleCopy: capability.userVisibleCopy,
    },
    externalJob: null,
    userVisibleCopy: capability.userVisibleCopy,
  };
}

export function classifyReminderDeliveryFailure(input: {
  reminderId: string;
  deliveryStatus: ReminderPlan["deliveryStatus"];
}): { reminderId: string; countsAsUserIgnored: false; reason: string } {
  return {
    reminderId: input.reminderId,
    countsAsUserIgnored: false,
    reason:
      input.deliveryStatus === "failed"
        ? "Reminder delivery failure is an adapter fact, not user behavior."
        : "Only explicit user behavior may be counted.",
  };
}

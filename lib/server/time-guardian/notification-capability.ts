import type { NotificationCapability } from "./types";

export type NotificationCapabilityDecision = {
  mode: "external" | "in-app-only";
  mayCreateExternalJob: boolean;
  userVisibleCopy: string;
};

export function canScheduleExternalReminder(capability: NotificationCapability): boolean {
  return capability === "external_granted";
}

export function describeNotificationCapability(capability: NotificationCapability): NotificationCapabilityDecision {
  if (canScheduleExternalReminder(capability)) {
    return {
      mode: "external",
      mayCreateExternalJob: true,
      userVisibleCopy: "External reminders are enabled for this card.",
    };
  }

  return {
    mode: "in-app-only",
    mayCreateExternalJob: false,
    userVisibleCopy: "Current reminder is in-app only; external notifications are not enabled.",
  };
}

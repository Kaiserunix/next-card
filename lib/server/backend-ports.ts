import type { SpeechTranscript } from "@/lib/server/voice/types";
import type { MultimodalExtractionPort } from "@/lib/server/input-layer/multimodal-port";
import type { PlanModeProviderPort } from "@/lib/server/plan-mode/types";
import type {
  NotificationCapability,
  QueueAction,
  ReminderPlan,
  ScheduleSnapshot,
  ScheduledEvent,
} from "@/lib/server/time-guardian/types";

export type SpeechProviderMode = "batch-audio" | "streaming";

export type SpeechToTextInput = {
  audioBase64: string;
  mimeType: string;
  durationMs: number;
  requestId: string;
  anonymousDeviceId: string;
};

export interface SpeechToTextPort {
  readonly provider: "volcengine" | "aliyun" | "tencent";
  readonly mode: SpeechProviderMode;
  transcribeAudio(input: SpeechToTextInput): Promise<SpeechTranscript>;
  createStreamingSession?(input: unknown): Promise<unknown>;
}

export interface TimeGuardianQueuePort {
  validateAndEnqueue(action: QueueAction, snapshot: ScheduleSnapshot): Promise<QueueAction>;
}

export interface ReminderNotificationPort {
  readonly capability: NotificationCapability;
  planReminder(reminder: ReminderPlan): Promise<{
    reminder: ReminderPlan;
    externalJobId: string | null;
    userVisibleCopy: string;
  }>;
}

export interface CalendarExportPort {
  requestCalendarExport(event: ScheduledEvent): Promise<{
    status: "not-supported" | "needs-user-confirmation" | "exported";
    calendarEventId: string | null;
    reason: string;
  }>;
}

export type BackendProviderPorts = {
  multimodalExtractor?: MultimodalExtractionPort;
  planModeProvider?: PlanModeProviderPort;
};

export type { MultimodalExtractionPort, PlanModeProviderPort };

import { buildScheduleSnapshot } from "@/lib/server/time-guardian/schedule-snapshot-builder";
import { scheduleCommittedDeck } from "@/lib/server/time-guardian/scheduling-kernel";
import { createBaselineReminderPlan } from "@/lib/server/time-guardian/reminder-baseline-service";
import { planReminderDelivery } from "@/lib/server/time-guardian/reminder-plan-service";
import { evaluateDeadlineWarning } from "@/lib/server/time-guardian/deadline-warning-engine";
import { planFreezeReturn } from "@/lib/server/time-guardian/freeze-return-service";
import { createSoftTaskSurfaceActions } from "@/lib/server/time-guardian/soft-task-surface-service";
import { validateNewTimeLockAuthority } from "@/lib/server/time-guardian/time-lock-validator";
import type {
  CommittedCardRef,
  CommittedDeckRef,
  FrozenQueueItem,
  QueueAction,
  ReminderPlan,
  ScheduleSnapshot,
  ScheduledEventKind,
  TaskTension,
  TimeLock,
  TimeWindow,
} from "@/lib/server/time-guardian/types";

const NOW = "2026-05-21T07:00:00+08:00";
const TZ = "Asia/Shanghai";

export type SimulatedCourse = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  confidence: number;
  verified: boolean;
};

export type SimulatedTask = {
  id: string;
  title: string;
  source: "ocr" | "notification" | "manual-dictation" | "system";
  tension: TaskTension;
  deadlineAt?: string;
  estimatedMinutes: number;
  confidence: number;
  verified: boolean;
};

export type UnverifiedCandidate = {
  id: string;
  label: string;
  source: "ocr" | "pdf" | "notification";
  reason: string;
};

export type OcrSimulationOutput = {
  rawText: string;
  courses: SimulatedCourse[];
  tasks: SimulatedTask[];
  unverifiedCandidates: UnverifiedCandidate[];
};

export type PlanningSimulationOutput = {
  decks: CommittedDeckRef[];
  cards: CommittedCardRef[];
};

export type TimelineEvent = {
  id: string;
  at: string;
  kind: ScheduledEventKind | "ocr-output" | "plan-output" | "deck-commit" | "proof-request" | "proof-append" | "queue-action";
  actor: "ocr-worker" | "planning-worker" | "deck-commit" | "time-guardian" | "proof-ledger" | "proof-audit";
  title: string;
  detail: string;
  severity: "calm" | "watch" | "risk" | "blocked" | "success";
};

export type FullTimelineSimulationReport = {
  generatedAt: string;
  ocrOutput: OcrSimulationOutput;
  planningOutput: PlanningSimulationOutput;
  snapshot: ScheduleSnapshot;
  queueActions: QueueAction[];
  reminderPlans: ReminderPlan[];
  timelineEvents: TimelineEvent[];
  metrics: {
    coursesParsed: number;
    tasksParsed: number;
    decksCommitted: number;
    timeProtectedCards: number;
    cardsScheduled: number;
    baselineReminders: number;
    inAppOnlyReminders: number;
    deadlineWarnings: number;
    freezeReturns: number;
    blockedUnverifiedHardLocks: number;
    directProofWrites: 0;
    directProfileWrites: 0;
  };
};

export type SimulationViewModel = {
  topModes: ["input", "deck", "proof"];
  agentTracks: Array<{
    id: TimelineEvent["actor"];
    label: string;
    summary: string;
  }>;
  metricCards: Array<{
    label: string;
    value: number;
    tone: "neutral" | "good" | "warn" | "blocked";
  }>;
  timelineRows: TimelineEvent[];
  unfinishedItems: Array<{
    id: string;
    title: string;
    status: "not-started" | "in-progress" | "blocked" | "future";
    reason: string;
  }>;
};

export function simulateOcrCourseAndTaskModel(): OcrSimulationOutput {
  return {
    rawText: [
      "08:00 高数 A 教学楼 3-204",
      "10:10 大学物理 实验楼 B201",
      "14:00 英语精读 主楼 502",
      "16:20 程序设计 机房 C3",
      "19:00 线代习题课 线上",
      "周五 09:00 形势与政策",
      "疑似 07:30 体育？图片模糊，需要复核",
      "今晚 21:30 前提交物理预习报告",
    ].join("\n"),
    courses: [
      course("course_calculus", "高数 A", "2026-05-21T08:00:00+08:00", "2026-05-21T09:30:00+08:00", "教学楼 3-204", 0.98),
      course("course_physics", "大学物理", "2026-05-21T10:10:00+08:00", "2026-05-21T11:40:00+08:00", "实验楼 B201", 0.96),
      course("course_english", "英语精读", "2026-05-21T14:00:00+08:00", "2026-05-21T15:30:00+08:00", "主楼 502", 0.94),
      course("course_programming", "程序设计", "2026-05-21T16:20:00+08:00", "2026-05-21T17:50:00+08:00", "机房 C3", 0.93),
      course("course_linear", "线代习题课", "2026-05-21T19:00:00+08:00", "2026-05-21T20:00:00+08:00", "线上", 0.91),
      course("course_policy", "形势与政策", "2026-05-22T09:00:00+08:00", "2026-05-22T10:30:00+08:00", "待确认教室", 0.88),
    ],
    tasks: [
      task("task_pack_calculus", "整理高数课本和上次作业页", "ocr", "hard", 10, 0.95, true),
      task("task_go_calculus", "出门去高数教室", "ocr", "hard", 15, 0.95, true),
      task("task_physics_lab", "带物理实验报告册", "ocr", "hard", 10, 0.92, true),
      task("task_english_words", "课前扫一遍英语课文标注", "ocr", "recommended", 12, 0.89, true),
      task("task_programming_usb", "检查程序设计作业文件能打开", "ocr", "recommended", 15, 0.9, true),
      task("task_linear_review", "线代习题课前挑 2 道错题", "ocr", "soft", 20, 0.86, true),
      task("task_physics_report", "提交物理预习报告最低可交版本", "notification", "deadline-sensitive", 35, 0.96, true, "2026-05-21T21:30:00+08:00"),
      task("task_report_polish", "补一段实验目的说明", "notification", "soft", 20, 0.86, true, "2026-05-21T21:30:00+08:00"),
      task("task_bag_charge", "给平板充电并装包", "manual-dictation", "recommended", 8, 0.9, true),
      task("task_lunch_block", "午休时间不排卡", "manual-dictation", "hard", 60, 1, true),
      task("task_tomorrow_policy", "明早形势与政策课前确认教室", "ocr", "recommended", 8, 0.82, true),
      task("task_system_recovery", "冻结后回来看一眼物理报告", "system", "soft", 10, 0.8, true),
    ],
    unverifiedCandidates: [
      {
        id: "candidate_pe_0730",
        label: "疑似 07:30 体育课",
        source: "ocr",
        reason: "低置信度图片区域，不能写成 hard lock。",
      },
    ],
  };
}

export function simulatePlanningModel(ocrOutput: OcrSimulationOutput): PlanningSimulationOutput {
  const decks: CommittedDeckRef[] = [
    deck("deck_calculus", "去高数课"),
    deck("deck_physics", "去大学物理"),
    deck("deck_english", "英语精读课前准备"),
    deck("deck_assignment", "物理预习报告"),
    deck("deck_linear_soft", "线代错题轻复盘"),
  ];

  return {
    decks,
    cards: [
      card("card_calculus_pack", "deck_calculus", "整理高数课本和作业页", "hard", 10, "2026-05-21T07:25:00+08:00", ["lock_course_calculus"]),
      card("card_physics_pack", "deck_physics", "带物理实验报告册", "hard", 10, "2026-05-21T09:45:00+08:00", ["lock_course_physics"]),
      card("card_english_scan", "deck_english", "扫一遍英语课文标注", "recommended", 12, "2026-05-21T13:35:00+08:00", ["lock_course_english"]),
      card(
        "card_report_minimum",
        "deck_assignment",
        "写出物理预习报告最低可交版本",
        "deadline-sensitive",
        35,
        "2026-05-21T20:15:00+08:00",
        ["lock_physics_report_due"],
        "2026-05-21T21:30:00+08:00",
      ),
      card("card_linear_review", "deck_linear_soft", "挑 2 道线代错题", "soft", 20, "2026-05-21T18:20:00+08:00", []),
    ],
  };

  function deck(deckId: string, title: string): CommittedDeckRef {
    return { deckId, chosenPlanId: "plan-b", title };
  }

  function card(
    cardId: string,
    deckId: string,
    title: string,
    tension: TaskTension,
    estimatedMinutes: number,
    preferredStartAt: string,
    hardLockRefs: string[],
    deadlineAt?: string,
  ): CommittedCardRef {
    return {
      cardId,
      deckId,
      chosenPlanId: "plan-b",
      title,
      tension,
      estimatedMinutes,
      preferredStartAt,
      hardLockRefs,
      deadlineAt,
    };
  }
}

export function runFullTimelineSimulation(): FullTimelineSimulationReport {
  const ocrOutput = simulateOcrCourseAndTaskModel();
  const planningOutput = simulatePlanningModel(ocrOutput);
  const timeLocks = createTimeLocks(ocrOutput);
  const availableWindows = createAvailableWindows();
  const frozenQueue: FrozenQueueItem[] = [
    {
      id: "frozen_report_followup",
      cardId: "card_report_followup",
      deckId: "deck_assignment",
      chosenPlanId: "plan-b",
      frozenAt: "2026-05-21T19:50:00+08:00",
      reason: "用户保存上下文，稍后回来看报告补充。",
      estimatedMinutes: 10,
      tension: "recommended",
      deadlineAt: "2026-05-21T21:30:00+08:00",
    },
  ];
  const snapshot = buildScheduleSnapshot({
    now: NOW,
    timezone: TZ,
    committedDecks: planningOutput.decks,
    activeCards: planningOutput.cards.map((card) => ({
      cardId: card.cardId,
      deckId: card.deckId,
      chosenPlanId: card.chosenPlanId,
      tension: card.tension,
      estimatedMinutes: card.estimatedMinutes,
      deadlineAt: card.deadlineAt,
      hardLockRefs: card.hardLockRefs,
      nudgeReminderIds: [],
      scheduleStatus: "unscheduled",
    })),
    scheduledEvents: [],
    timeLocks,
    availableWindows,
    frozenQueue,
    policySnapshotId: "policy_simulation_default",
  }).snapshot;

  const queueActions: QueueAction[] = [];
  const reminderPlans: ReminderPlan[] = [];
  const timelineEvents: TimelineEvent[] = [
    event("evt_ocr", NOW, "ocr-output", "ocr-worker", "OCR 模型吐出课程表和任务", `${ocrOutput.courses.length} 门课，${ocrOutput.tasks.length} 个任务，1 个低置信度候选。`, "calm"),
    event("evt_plan", "2026-05-21T07:00:20+08:00", "plan-output", "planning-worker", "大模型模拟器生成 plan-b decks", `${planningOutput.decks.length} 个 committed deck，所有卡片锁定 plan-b。`, "calm"),
    event(
      "evt_deck_commit",
      "2026-05-21T07:00:24+08:00",
      "deck-commit",
      "deck-commit",
      "Deck Commit 只提交用户选择的 plan-b",
      "写入 committed deck/card refs，生成 deck_committed proof request，不直接 append proof。",
      "success",
    ),
    event(
      "evt_proof_append_deck_committed",
      "2026-05-21T07:00:26+08:00",
      "proof-append",
      "proof-ledger",
      "Proof Ledger 追加中性 deck_committed",
      "Proof Ledger 是唯一 append-only writer；事件只表示生成卡组，不表示完成或评分。",
      "success",
    ),
  ];

  const blockedUnverifiedHardLocks = ocrOutput.unverifiedCandidates.filter((candidate) => {
    const validation = validateNewTimeLockAuthority({
      kind: "class_time",
      reviewStatus: "unverified",
      sourceType: candidate.source,
      sourceRefs: [],
    });
    if (!validation.allowed) {
      timelineEvents.push(
        event(
          `evt_block_${candidate.id}`,
          "2026-05-21T07:00:30+08:00",
          "review-request",
          "time-guardian",
          "拦截低置信度 OCR hard lock",
          validation.reason,
          "blocked",
        ),
      );
      return true;
    }
    return false;
  }).length;

  for (const deck of planningOutput.decks) {
    const result = scheduleCommittedDeck({
      snapshot,
      deck,
      chosenPlanId: "plan-b",
      cards: planningOutput.cards.filter((card) => card.deckId === deck.deckId),
    });
    queueActions.push(...result.queueActions);
  }

  for (const action of queueActions) {
    if (action.type !== "insert-schedule-event") continue;
    timelineEvents.push(
      event(
        `evt_${action.event.id}`,
        action.event.startsAt ?? action.event.fireAt ?? snapshot.now,
        action.event.kind,
        "time-guardian",
        `插入内部事件：${action.event.kind}`,
        action.event.reason,
        "success",
      ),
    );
  }

  const timeProtectedCards = planningOutput.cards.filter((card) => card.tension === "hard" || card.tension === "deadline-sensitive");
  for (const card of timeProtectedCards) {
    const targetTime = getTargetTime(card, timeLocks);
    const baseline = createBaselineReminderPlan({
      id: `baseline_${card.cardId}`,
      cardId: card.cardId,
      deckId: card.deckId,
      chosenPlanId: card.chosenPlanId,
      targetTime,
      now: snapshot.now,
    });
    const delivery = planReminderDelivery({ reminder: baseline, capability: "external_denied" });
    reminderPlans.push(delivery.reminder);
    queueActions.push({
      type: "create-baseline-reminder",
      id: `action_${baseline.id}`,
      snapshotId: snapshot.id,
      actor: "system-service",
      reason: "Create guaranteed baseline reminder for verified time-protected card.",
      createdAt: snapshot.now,
      chosenPlanId: card.chosenPlanId,
      reminder: delivery.reminder,
    });
    timelineEvents.push(
      event(
        `evt_${baseline.id}`,
        delivery.reminder.fireAt,
        delivery.reminder.kind === "in-app-only" ? "in-app-reminder" : "baseline-reminder",
        "time-guardian",
        "创建保底提醒并降级为应用内提醒",
        delivery.userVisibleCopy,
        "watch",
      ),
    );
  }

  const warning = evaluateDeadlineWarning({
    now: "2026-05-21T20:30:00+08:00",
    dueAt: "2026-05-21T21:30:00+08:00",
    remainingEstimatedMinutes: 55,
    fixedBusyWindows: [{ startsAt: "2026-05-21T21:00:00+08:00", endsAt: "2026-05-21T21:15:00+08:00" }],
    safetyBufferMinutes: 10,
    affectedCardIds: ["card_report_minimum"],
    estimateConfidence: 0.75,
  });
  queueActions.push({
    type: "emit-deadline-warning",
    id: "action_deadline_warning_report",
    snapshotId: snapshot.id,
    actor: "system-service",
    reason: warning.reason,
    createdAt: "2026-05-21T20:30:00+08:00",
    chosenPlanId: "plan-b",
    warning,
  });
  timelineEvents.push(
    event("evt_deadline_warning", "2026-05-21T20:30:00+08:00", "deadline-warning", "time-guardian", `Deadline warning: ${warning.level}`, warning.reason, "risk"),
  );

  const softActions = createSoftTaskSurfaceActions({
    snapshot: { ...snapshot, now: "2026-05-21T18:10:00+08:00" },
    card: planningOutput.cards.find((card) => card.cardId === "card_linear_review")!,
    timing: {
      recommendedGoodLineAt: "2026-05-21T18:00:00+08:00",
      mustNudgeAfterAt: "2026-05-21T18:40:00+08:00",
      hardensAt: "2026-05-21T19:30:00+08:00",
      deadlineAt: "2026-05-21T20:00:00+08:00",
      reason: "线代习题课前仍有一个轻复盘窗口。",
    },
    createdAt: "2026-05-21T18:10:00+08:00",
  });
  queueActions.push(...softActions.actions);
  timelineEvents.push(
    event("evt_soft_surface", "2026-05-21T18:10:00+08:00", "soft-task-surface", "time-guardian", "soft task 到达 good line", softActions.userVisibleCopy, "watch"),
  );

  const freezeReturn = planFreezeReturn({
    snapshot: { ...snapshot, now: "2026-05-21T20:35:00+08:00" },
    item: frozenQueue[0],
    createdAt: "2026-05-21T20:35:00+08:00",
  });
  queueActions.push(...freezeReturn.actions);
  timelineEvents.push(
    event("evt_freeze_return", "2026-05-21T20:35:00+08:00", "freeze-return", "time-guardian", "冻结卡回流 review", freezeReturn.reason, "success"),
  );

  timelineEvents.push(
    event("evt_proof_request", "2026-05-21T20:36:00+08:00", "proof-request", "proof-audit", "仅发出 proof event request", "Time Guardian 不直接 append proof/profile。", "calm"),
  );

  const sortedTimeline = timelineEvents.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  const insertActions = queueActions.filter((action) => action.type === "insert-schedule-event");

  return {
    generatedAt: new Date("2026-05-21T07:01:00+08:00").toISOString(),
    ocrOutput,
    planningOutput,
    snapshot,
    queueActions,
    reminderPlans,
    timelineEvents: sortedTimeline,
    metrics: {
      coursesParsed: ocrOutput.courses.length,
      tasksParsed: ocrOutput.tasks.length,
      decksCommitted: planningOutput.decks.length,
      timeProtectedCards: timeProtectedCards.length,
      cardsScheduled: insertActions.filter((action) => action.event.kind === "card-window").length,
      baselineReminders: reminderPlans.length,
      inAppOnlyReminders: reminderPlans.filter((plan) => plan.kind === "in-app-only").length,
      deadlineWarnings: 1,
      freezeReturns: freezeReturn.actions.filter((action) => action.type === "reinsert-frozen-card").length,
      blockedUnverifiedHardLocks,
      directProofWrites: 0,
      directProfileWrites: 0,
    },
  };
}

export function buildSimulationViewModel(report: FullTimelineSimulationReport): SimulationViewModel {
  return {
    topModes: ["input", "deck", "proof"],
    agentTracks: [
      { id: "ocr-worker", label: "OCR worker", summary: "模拟课程表、通知和模糊图片抽取。" },
      { id: "planning-worker", label: "Planning worker", summary: "模拟大模型把确认事实变成 plan-b deck/cards。" },
      { id: "deck-commit", label: "Deck Commit", summary: "只提交用户选择方案，生成 committed refs 和 proof request。" },
      { id: "time-guardian", label: "Time Guardian", summary: "运行 QueueAction、TimeLock、提醒、warning、freeze 回流。" },
      { id: "proof-ledger", label: "Proof Ledger", summary: "唯一 append-only proof writer，拒绝越权 proof。" },
      { id: "proof-audit", label: "Proof audit", summary: "只接收 proof request，不允许直接写 proof/profile。" },
    ],
    metricCards: [
      { label: "课程 OCR", value: report.metrics.coursesParsed, tone: "neutral" },
      { label: "任务解析", value: report.metrics.tasksParsed, tone: "neutral" },
      { label: "提交牌组", value: report.metrics.decksCommitted, tone: "good" },
      { label: "保底提醒", value: report.metrics.baselineReminders, tone: "good" },
      { label: "应用内降级", value: report.metrics.inAppOnlyReminders, tone: "warn" },
      { label: "OCR 拦截", value: report.metrics.blockedUnverifiedHardLocks, tone: "blocked" },
    ],
    timelineRows: report.timelineEvents,
    unfinishedItems: [
      {
        id: "todo_api_route",
        title: "Time Guardian 尚未接入 API route / deck commit event",
        status: "not-started",
        reason: "当前是 deterministic service slice，还没有 Next route 或 runtime queue store。",
      },
      {
        id: "todo_real_model",
        title: "OCR / LLM 仍是模拟 worker",
        status: "not-started",
        reason: "真实 Mimo/OCR/provider 接入需要 adapter 与 review gate。",
      },
      {
        id: "todo_external_notification",
        title: "外部通知、日历、移动端提醒未实现",
        status: "future",
        reason: "本阶段只允许 in-app-only honest downgrade。",
      },
      {
        id: "todo_proof_write",
        title: "Proof/Profile 权威写入仍未接线",
        status: "not-started",
        reason: "Time Guardian 只发 request，不能直接 append proof/profile。",
      },
    ],
  };
}

function course(
  id: string,
  title: string,
  startsAt: string,
  endsAt: string,
  location: string,
  confidence: number,
): SimulatedCourse {
  return { id, title, startsAt, endsAt, location, confidence, verified: confidence >= 0.85 };
}

function task(
  id: string,
  title: string,
  source: SimulatedTask["source"],
  tension: TaskTension,
  estimatedMinutes: number,
  confidence: number,
  verified: boolean,
  deadlineAt?: string,
): SimulatedTask {
  return { id, title, source, tension, estimatedMinutes, confidence, verified, deadlineAt };
}

function createTimeLocks(ocrOutput: OcrSimulationOutput): TimeLock[] {
  const courseLocks = ocrOutput.courses
    .filter((course) => course.verified)
    .map<TimeLock>((course) => ({
      id: `lock_${course.id}`,
      userId: "anon",
      kind: "class_time",
      startAt: course.startsAt,
      endAt: course.endsAt,
      timezone: TZ,
      movable: false,
      sourceRefs: [{ rawInputId: `raw_${course.id}`, quote: course.title, confidence: course.confidence }],
      reviewStatus: "verified",
      conflictStatus: "none",
    }));

  return [
    ...courseLocks,
    {
      id: "lock_lunch",
      userId: "anon",
      kind: "user_locked_block",
      startAt: "2026-05-21T12:00:00+08:00",
      endAt: "2026-05-21T13:00:00+08:00",
      timezone: TZ,
      movable: false,
      sourceRefs: [{ rawInputId: "manual_lunch", quote: "午休时间不排卡", confidence: 1 }],
      reviewStatus: "user-confirmed",
      conflictStatus: "none",
    },
    {
      id: "lock_physics_report_due",
      userId: "anon",
      kind: "submission_deadline",
      dueAt: "2026-05-21T21:30:00+08:00",
      timezone: TZ,
      movable: false,
      sourceRefs: [{ rawInputId: "notification_report", quote: "今晚 21:30 前提交物理预习报告", confidence: 0.96 }],
      reviewStatus: "user-confirmed",
      conflictStatus: "none",
    },
  ];
}

function createAvailableWindows(): TimeWindow[] {
  return [
    window("window_before_calculus", "2026-05-21T07:10:00+08:00", "2026-05-21T07:50:00+08:00"),
    window("window_before_physics", "2026-05-21T09:35:00+08:00", "2026-05-21T10:05:00+08:00"),
    window("window_before_english", "2026-05-21T13:20:00+08:00", "2026-05-21T13:55:00+08:00"),
    window("window_linear", "2026-05-21T18:10:00+08:00", "2026-05-21T18:50:00+08:00"),
    window("window_report", "2026-05-21T20:10:00+08:00", "2026-05-21T21:25:00+08:00"),
    window("window_freeze_return", "2026-05-21T20:40:00+08:00", "2026-05-21T20:55:00+08:00"),
  ];
}

function window(id: string, startAt: string, endAt: string): TimeWindow {
  return { id, startAt, endAt, timezone: TZ, source: "derived", confidence: 0.9 };
}

function getTargetTime(card: CommittedCardRef, locks: TimeLock[]): string {
  if (card.deadlineAt) return card.deadlineAt;
  const referencedLock = locks.find((lock) => card.hardLockRefs.includes(lock.id));
  return referencedLock?.startAt ?? card.preferredStartAt ?? NOW;
}

function event(
  id: string,
  at: string,
  kind: TimelineEvent["kind"],
  actor: TimelineEvent["actor"],
  title: string,
  detail: string,
  severity: TimelineEvent["severity"],
): TimelineEvent {
  return {
    id,
    at: new Date(Date.parse(at)).toISOString(),
    kind,
    actor,
    title,
    detail,
    severity,
  };
}

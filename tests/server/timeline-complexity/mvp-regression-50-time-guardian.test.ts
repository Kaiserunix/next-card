import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { insertScheduledEvent } from "@/lib/server/time-guardian/scheduled-event-inserter";
import { scheduleCommittedDeck } from "@/lib/server/time-guardian/scheduling-kernel";
import { validateQueueAction } from "@/lib/server/time-guardian/queue-action-validator";
import { compareIso, rangesOverlap } from "@/lib/server/time-guardian/time-overlap";
import type {
  CommittedCardRef,
  CommittedDeckRef,
  QueueAction,
  ScheduleSnapshot,
  ScheduledEvent,
  TaskTension,
  TimeLock,
  TimeWindow,
} from "@/lib/server/time-guardian/types";

const CORPUS_DIR = "docs/superpowers/test-images/2026-05-21-mvp-regression-50";
const SEED = 20260521;
const NOW = "2026-05-21T07:00:00+08:00";
const TZ = "Asia/Shanghai";

type ManifestRecord = {
  id: string;
  imageFile: string;
  category: string;
  difficulty: string;
  expectedReview: "light" | "strict" | "blocked";
  sourceIndex: number;
};

type OracleRecord = ManifestRecord & {
  sourceType: string;
  expectedCandidates: string[];
  expectedWarnings: string[];
  mustNotDo: string[];
};

type MvpRegressionScenario = {
  id: string;
  index: number;
  records: OracleRecord[];
  blocked: boolean;
  forceConflict: boolean;
};

describe("mvp-regression-50 Time Guardian combinations", () => {
  const records = loadOracleRecords();
  const scenarios = buildDeterministicScenarios(records);

  it("loads the full local image oracle set and builds exactly 100 seeded combinations", () => {
    expect(records).toHaveLength(50);
    expect(scenarios).toHaveLength(100);
    expect(scenarios.every((scenario) => scenario.records.length >= 1)).toBe(true);

    const categoryCounts = records.reduce<Record<string, number>>((acc, record) => {
      acc[record.category] = (acc[record.category] ?? 0) + 1;
      expect(existsSync(join(CORPUS_DIR, record.imageFile))).toBe(true);
      return acc;
    }, {});

    expect(categoryCounts).toMatchObject({
      assignment: 10,
      blocked: 2,
      chat: 5,
      conflict: 4,
      "low-quality": 5,
      notification: 3,
      "prompt-injection-like-document-content": 3,
      "relative-date": 6,
      timetable: 12,
    });
  });

  it.each(scenarios)("$id: protects timeline schedule, insertion, and conflict invariants", (scenario) => {
    const snapshot = snapshotForScenario(scenario);
    const deck = deckForScenario(scenario);
    const cards = cardsForScenario(scenario);

    if (scenario.blocked) {
      expect(cards).toHaveLength(0);
      const result = scheduleCommittedDeck({
        snapshot,
        deck,
        cards,
        chosenPlanId: deck.chosenPlanId,
      });

      expect(result.scheduleProposal.placements).toHaveLength(0);
      expect(result.queueActions).toHaveLength(0);
      expect(result.scheduleProposal.conflicts).toHaveLength(0);
      return;
    }

    const unselectedShadowCard: CommittedCardRef = {
      ...cards[0],
      cardId: `${cards[0].cardId}_plan_a_shadow`,
      chosenPlanId: "plan-a",
    };
    const result = scheduleCommittedDeck({
      snapshot,
      deck,
      cards: [...cards, unselectedShadowCard],
      chosenPlanId: deck.chosenPlanId,
    });

    expect(result.scheduleProposal.placements).not.toContainEqual(
      expect.objectContaining({ cardId: unselectedShadowCard.cardId }),
    );
    expect(result.scheduleProposal.placements.every((placement) => placement.chosenPlanId === deck.chosenPlanId)).toBe(true);

    if (scenario.forceConflict) {
      expect(result.queueActions.some((action) => action.type === "request-user-review")).toBe(true);
      expect(result.scheduleProposal.conflicts.length).toBeGreaterThan(0);
    } else {
      expect(result.scheduleProposal.conflicts).toEqual([]);
      expect(result.queueActions.some((action) => action.type === "insert-schedule-event")).toBe(true);
    }

    assertPlacementsRespectTimeLocks(result.scheduleProposal.placements, snapshot.timeLocks);
    assertPlacementsRespectExistingEvents(result.scheduleProposal.placements, snapshot.scheduledEvents);
    assertPlacementsRespectActiveCards(result.scheduleProposal.placements, snapshot.activeCards);
    assertPlacementsRespectDeadlines(result.scheduleProposal.placements, cards);
    assertNoForbiddenSourceCommandsLeak(scenario, result.queueActions);

    let evolved = snapshot;
    for (const action of result.queueActions) {
      const validation = validateQueueAction(action, {
        snapshot: evolved,
        expectedChosenPlanId: deck.chosenPlanId,
        notificationCapability: "in_app_only",
      });
      expect(validation.allowed, validation.reason).toBe(true);

      if (action.type !== "insert-schedule-event") continue;

      const insertion = insertScheduledEvent(evolved, action, {
        expectedChosenPlanId: deck.chosenPlanId,
        notificationCapability: "in_app_only",
      });
      expect(insertion.inserted, insertion.reason).toBe(true);
      evolved = insertion.snapshot;
    }

    assertSnapshotTimelineHasNoOverlaps(evolved);
    assertTimeLocksWereNotMoved(snapshot, evolved);
  });
});

function loadOracleRecords(): OracleRecord[] {
  const manifest = readJson<{ records: ManifestRecord[] }>(join(CORPUS_DIR, "manifest.json"));

  return manifest.records.map((record) => {
    const oracle = readJson<{
      sourceType: string;
      expectedCandidates?: string[];
      expectedWarnings?: string[];
      mustNotDo?: string[];
    }>(join(CORPUS_DIR, `${record.id}.json`));

    return {
      ...record,
      sourceType: oracle.sourceType,
      expectedCandidates: oracle.expectedCandidates ?? [],
      expectedWarnings: oracle.expectedWarnings ?? [],
      mustNotDo: oracle.mustNotDo ?? [],
    };
  });
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as T;
}

function buildDeterministicScenarios(records: OracleRecord[]): MvpRegressionScenario[] {
  const sorted = [...records].sort((left, right) => left.id.localeCompare(right.id));
  const scenarios: MvpRegressionScenario[] = [];
  const categories = ["timetable", "assignment", "notification", "relative-date", "conflict", "low-quality", "prompt-injection-like-document-content", "chat"];

  for (let index = 0; index < sorted.length; index += 1) {
    scenarios.push(scenarioFromRecords(index, [sorted[index], pickPartner(sorted, sorted[index], index, categories[index % categories.length])]));
  }

  for (let index = 0; index < sorted.length; index += 1) {
    const anchor = sorted[(index * 7 + 3) % sorted.length];
    const partner = pickPartner(sorted, anchor, index + 50, categories[(index * 3 + 1) % categories.length]);
    const third = pickPartner(sorted, partner, index + 100, categories[(index * 5 + 2) % categories.length]);
    scenarios.push(scenarioFromRecords(index + 50, uniqueRecords([anchor, partner, third])));
  }

  return scenarios;
}

function scenarioFromRecords(index: number, records: OracleRecord[]): MvpRegressionScenario {
  const blocked = records.some((record) => record.expectedReview === "blocked" || record.category === "blocked");
  const forceConflict =
    !blocked &&
    records.some((record) => {
      const text = oracleText(record);
      return record.category === "conflict" || /conflict|overlap|move class|schedule essay during class|authority/.test(text);
    });

  return {
    id: `combo-${String(index + 1).padStart(3, "0")}-${records.map((record) => record.id).join("__")}`,
    index,
    records,
    blocked,
    forceConflict,
  };
}

function pickPartner(records: OracleRecord[], anchor: OracleRecord, salt: number, preferredCategory: string): OracleRecord {
  const pool = records.filter((record) => record.category === preferredCategory && record.id !== anchor.id);
  const candidates = pool.length > 0 ? pool : records.filter((record) => record.id !== anchor.id);
  return candidates[hash(`${SEED}:${anchor.id}:${salt}:${preferredCategory}`) % candidates.length];
}

function uniqueRecords(records: OracleRecord[]): OracleRecord[] {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

function snapshotForScenario(scenario: MvpRegressionScenario): ScheduleSnapshot {
  return {
    id: `snapshot_${scenario.index}`,
    version: 1,
    now: NOW,
    timezone: TZ,
    committedDecks: [deckForScenario(scenario)],
    activeCards: scenario.forceConflict
      ? []
      : scenario.index % 5 === 0
        ? [
            {
              cardId: `active_${scenario.index}`,
              deckId: `deck_${scenario.index}`,
              chosenPlanId: "plan-b",
              tension: "recommended",
              estimatedMinutes: 20,
              scheduledWindow: window(`active_window_${scenario.index}`, "2026-05-21T09:40:00+08:00", "2026-05-21T10:00:00+08:00"),
              hardLockRefs: [],
              nudgeReminderIds: [],
              scheduleStatus: "scheduled",
            },
          ]
        : [],
    scheduledEvents: scenario.forceConflict
      ? []
      : scenario.index % 4 === 0
        ? [
            scheduledEvent({
              id: `event_existing_${scenario.index}`,
              cardId: `existing_${scenario.index}`,
              startsAt: "2026-05-21T19:00:00+08:00",
              endsAt: "2026-05-21T19:30:00+08:00",
              basedOnSnapshotId: `snapshot_${scenario.index}`,
            }),
          ]
        : [],
    timeLocks: timeLocksForScenario(scenario),
    availableWindows: windowsForScenario(scenario),
    frozenQueue: [],
    policySnapshotId: "policy_mvp_regression_50",
  };
}

function deckForScenario(scenario: MvpRegressionScenario): CommittedDeckRef {
  return {
    deckId: `deck_${scenario.index}`,
    chosenPlanId: "plan-b",
    title: scenario.records.map((record) => record.id).join(" + ").slice(0, 80),
  };
}

function cardsForScenario(scenario: MvpRegressionScenario): CommittedCardRef[] {
  if (scenario.blocked) return [];

  const cards = scenario.records
    .filter((record) => record.expectedReview !== "blocked" && record.category !== "blocked")
    .slice(0, 3)
    .map((record, recordIndex) => cardForRecord(scenario, record, recordIndex));

  return cards.length > 0 ? cards : [fallbackReviewCard(scenario)];
}

function cardForRecord(scenario: MvpRegressionScenario, record: OracleRecord, recordIndex: number): CommittedCardRef {
  const base = {
    cardId: `card_${scenario.index}_${recordIndex}_${record.id.replace(/[^a-z0-9]+/gi, "_")}`,
    deckId: `deck_${scenario.index}`,
    chosenPlanId: "plan-b",
    title: record.expectedCandidates[0] ?? record.id,
    hardLockRefs: [] as string[],
  };

  if (scenario.forceConflict) {
    return {
      ...base,
      tension: "hard",
      estimatedMinutes: 35,
      preferredStartAt: "2026-05-21T08:10:00+08:00",
      hardLockRefs: ["lock_morning_class"],
    };
  }

  if (record.category === "timetable") {
    return {
      ...base,
      tension: "hard",
      estimatedMinutes: 20,
      preferredStartAt: "2026-05-21T07:10:00+08:00",
      hardLockRefs: ["lock_morning_class"],
    };
  }

  if (["assignment", "notification", "relative-date", "prompt-injection-like-document-content"].includes(record.category)) {
    return {
      ...base,
      tension: "deadline-sensitive",
      estimatedMinutes: 25 + (recordIndex % 2) * 10,
      preferredStartAt: record.category === "notification" ? "2026-05-21T16:30:00+08:00" : "2026-05-21T19:10:00+08:00",
      deadlineAt: record.category === "notification" ? "2026-05-21T17:30:00+08:00" : "2026-05-21T21:30:00+08:00",
    };
  }

  if (record.category === "chat") {
    return {
      ...base,
      tension: "recommended",
      estimatedMinutes: 15,
      preferredStartAt: "2026-05-21T10:10:00+08:00",
    };
  }

  return {
    ...base,
    tension: "soft",
    estimatedMinutes: 10,
    preferredStartAt: "2026-05-21T13:40:00+08:00",
  };
}

function fallbackReviewCard(scenario: MvpRegressionScenario): CommittedCardRef {
  return {
    cardId: `card_${scenario.index}_manual_review`,
    deckId: `deck_${scenario.index}`,
    chosenPlanId: "plan-b",
    title: "Review confirmed source facts",
    tension: "recommended",
    estimatedMinutes: 10,
    hardLockRefs: [],
    preferredStartAt: "2026-05-21T13:40:00+08:00",
  };
}

function timeLocksForScenario(scenario: MvpRegressionScenario): TimeLock[] {
  const locks: TimeLock[] = [
    timeLock("lock_morning_class", "class_time", "2026-05-21T08:00:00+08:00", "2026-05-21T09:30:00+08:00", scenario),
    timeLock("lock_lunch", "user_locked_block", "2026-05-21T12:00:00+08:00", "2026-05-21T13:00:00+08:00", scenario),
  ];

  if (scenario.forceConflict) {
    locks.push(timeLock("lock_conflicting_class", "class_time", "2026-05-21T08:20:00+08:00", "2026-05-21T09:20:00+08:00", scenario));
  }

  if (scenario.records.some((record) => ["assignment", "relative-date", "prompt-injection-like-document-content"].includes(record.category))) {
    locks.push(deadlineLock("lock_assignment_due", "2026-05-21T21:30:00+08:00", scenario));
  }

  if (scenario.records.some((record) => record.category === "notification")) {
    locks.push(deadlineLock("lock_response_due", "2026-05-21T17:30:00+08:00", scenario));
  }

  return locks;
}

function windowsForScenario(scenario: MvpRegressionScenario): TimeWindow[] {
  if (scenario.forceConflict) {
    return [
      window("window_conflict_with_class", "2026-05-21T08:10:00+08:00", "2026-05-21T08:55:00+08:00"),
      window("window_too_short_after_class", "2026-05-21T09:40:00+08:00", "2026-05-21T09:50:00+08:00"),
    ];
  }

  return [
    window("window_before_class", "2026-05-21T07:00:00+08:00", "2026-05-21T07:55:00+08:00"),
    window("window_after_class", "2026-05-21T09:40:00+08:00", "2026-05-21T11:30:00+08:00"),
    window("window_afternoon", "2026-05-21T13:30:00+08:00", "2026-05-21T16:20:00+08:00"),
    window("window_notification_response", "2026-05-21T16:20:00+08:00", "2026-05-21T17:30:00+08:00"),
    window("window_evening", "2026-05-21T18:30:00+08:00", "2026-05-21T21:25:00+08:00"),
  ];
}

function timeLock(
  id: string,
  kind: TimeLock["kind"],
  startAt: string,
  endAt: string,
  scenario: MvpRegressionScenario,
): TimeLock {
  return {
    id,
    userId: "anon",
    kind,
    startAt,
    endAt,
    timezone: TZ,
    movable: false,
    sourceRefs: [{ rawInputId: scenario.records[0].id, quote: scenario.records[0].id, confidence: 0.95 }],
    reviewStatus: "user-confirmed",
    conflictStatus: scenario.forceConflict ? "conflict_detected" : "none",
  };
}

function deadlineLock(id: string, dueAt: string, scenario: MvpRegressionScenario): TimeLock {
  return {
    id,
    userId: "anon",
    kind: "submission_deadline",
    dueAt,
    timezone: TZ,
    movable: false,
    sourceRefs: [{ rawInputId: scenario.records[0].id, quote: "confirmed deadline", confidence: 0.93 }],
    reviewStatus: "user-confirmed",
    conflictStatus: "none",
  };
}

function window(id: string, startAt: string, endAt: string): TimeWindow {
  return { id, startAt, endAt, timezone: TZ, source: "derived", confidence: 0.92 };
}

function scheduledEvent(overrides: Partial<ScheduledEvent>): ScheduledEvent {
  return {
    id: "event_existing",
    userId: "anon",
    kind: "card-window",
    deckId: "existing_deck",
    cardId: "existing_card",
    chosenPlanId: "plan-b",
    startsAt: "2026-05-21T19:00:00+08:00",
    endsAt: "2026-05-21T19:30:00+08:00",
    timezone: TZ,
    source: "time-guardian",
    status: "inserted",
    basedOnSnapshotId: "snapshot_existing",
    sourceRefs: [],
    reason: "Existing internal card window.",
    ...overrides,
  };
}

function assertPlacementsRespectTimeLocks(
  placements: Array<{ cardId: string; window: TimeWindow }>,
  locks: TimeLock[],
): void {
  for (const placement of placements) {
    for (const lock of locks) {
      if (!lock.startAt || !lock.endAt) continue;
      expect(
        rangesOverlap(placement.window.startAt, placement.window.endAt, lock.startAt, lock.endAt),
        `${placement.cardId} overlaps ${lock.id}`,
      ).toBe(false);
    }
  }
}

function assertPlacementsRespectExistingEvents(
  placements: Array<{ cardId: string; window: TimeWindow }>,
  events: ScheduledEvent[],
): void {
  for (const placement of placements) {
    for (const event of events) {
      if (!event.startsAt || !event.endsAt || event.status === "cancelled") continue;
      expect(
        rangesOverlap(placement.window.startAt, placement.window.endAt, event.startsAt, event.endsAt),
        `${placement.cardId} overlaps existing event ${event.id}`,
      ).toBe(false);
    }
  }
}

function assertPlacementsRespectActiveCards(
  placements: Array<{ cardId: string; window: TimeWindow }>,
  activeCards: ScheduleSnapshot["activeCards"],
): void {
  for (const placement of placements) {
    for (const activeCard of activeCards) {
      if (!activeCard.scheduledWindow) continue;
      expect(
        rangesOverlap(
          placement.window.startAt,
          placement.window.endAt,
          activeCard.scheduledWindow.startAt,
          activeCard.scheduledWindow.endAt,
        ),
        `${placement.cardId} overlaps active card ${activeCard.cardId}`,
      ).toBe(false);
    }
  }
}

function assertPlacementsRespectDeadlines(
  placements: Array<{ cardId: string; window: TimeWindow }>,
  cards: CommittedCardRef[],
): void {
  const cardsById = new Map(cards.map((card) => [card.cardId, card]));
  for (const placement of placements) {
    const deadlineAt = cardsById.get(placement.cardId)?.deadlineAt;
    if (!deadlineAt) continue;
    expect(compareIso(placement.window.endAt, deadlineAt), `${placement.cardId} ends after ${deadlineAt}`).toBeLessThanOrEqual(0);
  }
}

function assertSnapshotTimelineHasNoOverlaps(snapshot: ScheduleSnapshot): void {
  const ranges = [
    ...snapshot.scheduledEvents
      .filter((event) => event.startsAt && event.endsAt && event.status !== "cancelled")
      .map((event) => ({ id: event.id, startAt: event.startsAt!, endAt: event.endsAt! })),
    ...snapshot.activeCards
      .filter((card) => card.scheduledWindow)
      .map((card) => ({ id: card.cardId, startAt: card.scheduledWindow!.startAt, endAt: card.scheduledWindow!.endAt })),
  ].sort((left, right) => compareIso(left.startAt, right.startAt));

  for (let leftIndex = 0; leftIndex < ranges.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < ranges.length; rightIndex += 1) {
      const left = ranges[leftIndex];
      const right = ranges[rightIndex];
      expect(rangesOverlap(left.startAt, left.endAt, right.startAt, right.endAt), `${left.id} overlaps ${right.id}`).toBe(false);
    }
  }
}

function assertTimeLocksWereNotMoved(before: ScheduleSnapshot, after: ScheduleSnapshot): void {
  expect(after.timeLocks).toEqual(before.timeLocks);
}

function assertNoForbiddenSourceCommandsLeak(scenario: MvpRegressionScenario, actions: QueueAction[]): void {
  const serialized = JSON.stringify(actions).toLowerCase();
  const sourceText = scenario.records.map(oracleText).join(" ").toLowerCase();

  if (/delete|ignore|system|mark complete/.test(sourceText)) {
    expect(serialized).not.toMatch(/delete reminder|delete schedule|ignore previous|mark complete|system:/);
  }

  expect(serialized).not.toMatch(/"type":"move-|delete-earlier|cancel-homework|schedule-old/);
}

function oracleText(record: OracleRecord): string {
  return [...record.expectedCandidates, ...record.expectedWarnings, ...record.mustNotDo].join(" ").toLowerCase();
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

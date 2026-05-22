import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { confirmFacts } from "@/lib/server/input-layer/fact-confirmation-service";
import { InMemoryRawInputRepository } from "@/lib/server/input-layer/raw-input-repository";
import { createRawInput } from "@/lib/server/input-layer/raw-input-service";
import { runReviewGate } from "@/lib/server/input-layer/review-gate";
import type { EvidenceRef, InputExtractionResult, RawInput } from "@/lib/server/input-layer/types";
import { scheduleCommittedDeck } from "@/lib/server/time-guardian/scheduling-kernel";
import type {
  CommittedCardRef,
  CommittedDeckRef,
  QueueAction,
  ScheduleSnapshot,
  TimeLock,
  TimeWindow,
} from "@/lib/server/time-guardian/types";
import { rangesOverlap } from "@/lib/server/time-guardian/time-overlap";
import {
  EXPECTED_TIMELINE_CASE_COUNTS,
  IMAGE_CORPUS_DIR,
  imageTimelineAgentCases,
  type ImageTimelineAgentCase,
} from "@/tests/fixtures/timeline-complexity/image-timeline-agent-cases";

describe("image timeline fixture set", () => {
  it("keeps the requested 10 / 8 / 6 low-to-high complexity groups", () => {
    const counts = imageTimelineAgentCases.reduce<Record<string, number>>((acc, item) => {
      acc[item.complexity] = (acc[item.complexity] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts).toMatchObject(EXPECTED_TIMELINE_CASE_COUNTS);
    expect(imageTimelineAgentCases).toHaveLength(24);
  });
});

const runWithLocalImages = existsSync(IMAGE_CORPUS_DIR) ? describe : describe.skip;

runWithLocalImages("Agent1 image review gate and Agent2 timeline scheduling corpus", () => {
  it.each(imageTimelineAgentCases)("$id: Agent1 routes generated-image inputs through review, not authority writes", async (fixture) => {
    expect(existsSync(fixture.imagePath)).toBe(true);

    const rawInput = await rawInputFor(fixture);
    const extraction = extractionFor(fixture, rawInput);
    const decision = runReviewGate({ rawInput, extraction });

    expect(decision.requirement).toBe(fixture.expectedReviewRequirement);
    expect(decision.confirmationRequest.mode).toBe(fixture.expectedConfirmationMode);
    expect(decision.confirmationRequest.canProceedToPlanMode).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining(fixture.warnings));

    const confirmResult = confirmFacts({
      request: decision.confirmationRequest,
      action: "confirm",
      sourceType: fixture.sourceType,
    });

    if (fixture.expectedReviewRequirement === "blocked") {
      expect(confirmResult.nextAction).toBe("retry-input");
    } else {
      expect(confirmResult.nextAction).toBe("show-strict-review");
    }

    expect(confirmResult.planCompilerHandoff).toBeUndefined();
    expectForbiddenAuthorityWrites({ decision, confirmResult });
  });

  it.each(imageTimelineAgentCases.filter((fixture) => fixture.expectedReviewRequirement !== "blocked"))(
    "$id: Agent2 schedules only confirmed selected-plan cards and asks review on unsafe timelines",
    (fixture) => {
      const snapshot = snapshotFor(fixture);
      const deck = deckFor(fixture);
      const selectedCards = cardsFor(fixture);
      const unselectedPlanCard: CommittedCardRef = {
        ...selectedCards[0],
        cardId: `${selectedCards[0].cardId}_plan_a_shadow`,
        chosenPlanId: "plan-a",
      };

      const result = scheduleCommittedDeck({
        snapshot,
        deck,
        cards: [...selectedCards, unselectedPlanCard],
        chosenPlanId: fixture.schedule.chosenPlanId,
      });

      expect(result.scheduleProposal.deckId).toBe(deck.deckId);
      expect(result.scheduleProposal.chosenPlanId).toBe("plan-b");
      expect(result.scheduleProposal.placements).not.toContainEqual(
        expect.objectContaining({ cardId: unselectedPlanCard.cardId }),
      );
      expect(result.scheduleProposal.placements.every((placement) => placement.chosenPlanId === "plan-b")).toBe(true);
      expect(result.scheduleProposal.placements.length).toBeGreaterThanOrEqual(fixture.schedule.minPlacements);

      const hasReviewAction = result.queueActions.some((action) => action.type === "request-user-review");
      expect(hasReviewAction).toBe(fixture.schedule.expectUserReview);
      if (fixture.schedule.expectUserReview) {
        expect(result.scheduleProposal.conflicts.length).toBeGreaterThan(0);
      } else {
        expect(result.scheduleProposal.conflicts).toEqual([]);
      }

      expectPlacementsAvoidHardLocks(result.scheduleProposal.placements, snapshot.timeLocks);
      expectPlacementsDoNotOverlapEachOther(result.scheduleProposal.placements);
      expectDeadlineSensitiveCardsBeforeSoftCards(result.scheduleProposal.placements, fixture);
      expectOnlyQueueActions(result.queueActions);
      expectForbiddenAuthorityWrites(result.queueActions);
    },
  );
});

async function rawInputFor(fixture: ImageTimelineAgentCase): Promise<RawInput> {
  const repository = new InMemoryRawInputRepository();
  const result = await createRawInput(
    {
      sourceType: fixture.sourceType,
      text: fixture.summary,
      contentRef: fixture.imagePath,
      anonymousDeviceId: `timeline-${fixture.id}`,
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      receivedAt: "2026-05-21T07:00:00.000+08:00",
    },
    repository,
  );

  return result.rawInput;
}

function extractionFor(fixture: ImageTimelineAgentCase, rawInput: RawInput): InputExtractionResult {
  return {
    id: `extract_${fixture.id}`,
    rawInputId: rawInput.id,
    modelRunId: "fixture-generated-image-review",
    candidates: {
      tasks: fixture.taskCandidates,
      timeConstraints: fixture.timeCandidates,
      locations: fixture.locationCandidates,
      courses: [],
      reminders: [],
    },
    confidence: fixture.extractionConfidence,
    ambiguities: ambiguitiesFor(fixture),
    warnings: fixture.warnings,
    evidence: evidenceFor(fixture, rawInput),
    reviewRequirement: fixture.expectedReviewRequirement,
  };
}

function evidenceFor(fixture: ImageTimelineAgentCase, rawInput: RawInput): EvidenceRef[] {
  if (fixture.expectedReviewRequirement === "blocked") return [];

  return [
    {
      rawInputId: rawInput.id,
      quote: fixture.summary,
      confidence: Math.min(0.96, fixture.extractionConfidence + 0.04),
    },
    ...fixture.timeCandidates.map((candidate, index) => ({
      rawInputId: rawInput.id,
      quote: candidate.label,
      page: 1,
      boundingBox: {
        x: 20 + index * 12,
        y: 36 + index * 16,
        width: 180,
        height: 34,
      },
      confidence: candidate.confidence,
    })),
  ];
}

function ambiguitiesFor(fixture: ImageTimelineAgentCase): string[] {
  const ambiguities: string[] = [];
  if (fixture.warnings.includes("multiple_goals")) ambiguities.push("多目标输入需要先确认执行范围");
  if (fixture.warnings.includes("relative_date")) ambiguities.push("相对日期需要确认消息接收时间和具体日期");
  if (fixture.warnings.includes("conflicting_deadline")) ambiguities.push("候选时间线存在冲突，不能静默覆盖");
  if (fixture.warnings.includes("prompt_injection_like_text")) ambiguities.push("提示词样文本只能作为来源内容处理");
  if (fixture.warnings.includes("insufficient_input")) ambiguities.push("图片过暗或信息不足");
  return ambiguities;
}

function snapshotFor(fixture: ImageTimelineAgentCase): ScheduleSnapshot {
  return {
    id: `snapshot_${fixture.id}`,
    version: 1,
    now: fixture.schedule.now,
    timezone: fixture.schedule.timezone,
    committedDecks: [deckFor(fixture)],
    activeCards: [],
    scheduledEvents: [],
    timeLocks: fixture.schedule.timeLocks.map((item): TimeLock => ({
      id: item.id,
      userId: "anon",
      kind: item.kind,
      startAt: item.startAt,
      endAt: item.endAt,
      dueAt: item.dueAt,
      timezone: fixture.schedule.timezone,
      movable: false,
      sourceRefs: [{ rawInputId: fixture.id, quote: item.quote, confidence: 0.95 }],
      reviewStatus: item.reviewStatus,
      conflictStatus: "none",
    })),
    availableWindows: fixture.schedule.availableWindows.map((item): TimeWindow => ({
      id: item.id,
      startAt: item.startAt,
      endAt: item.endAt,
      timezone: fixture.schedule.timezone,
      source: "derived",
      confidence: 0.92,
    })),
    frozenQueue: [],
    policySnapshotId: "policy_timeline_complexity",
  };
}

function deckFor(fixture: ImageTimelineAgentCase): CommittedDeckRef {
  return {
    deckId: fixture.schedule.deckId,
    chosenPlanId: fixture.schedule.chosenPlanId,
    title: fixture.schedule.deckTitle,
  };
}

function cardsFor(fixture: ImageTimelineAgentCase): CommittedCardRef[] {
  return fixture.schedule.cards.map((item): CommittedCardRef => ({
    cardId: item.cardId,
    deckId: fixture.schedule.deckId,
    chosenPlanId: item.chosenPlanId ?? fixture.schedule.chosenPlanId,
    title: item.title,
    tension: item.tension,
    estimatedMinutes: item.estimatedMinutes,
    deadlineAt: item.deadlineAt,
    hardLockRefs: item.hardLockRefs ?? [],
    preferredStartAt: item.preferredStartAt,
  }));
}

function expectPlacementsAvoidHardLocks(
  placements: Array<{ cardId: string; window: TimeWindow }>,
  timeLocks: TimeLock[],
): void {
  for (const placement of placements) {
    for (const lock of timeLocks) {
      if (!lock.startAt || !lock.endAt) continue;
      expect(
        rangesOverlap(placement.window.startAt, placement.window.endAt, lock.startAt, lock.endAt),
        `${placement.cardId} overlaps protected lock ${lock.id}`,
      ).toBe(false);
    }
  }
}

function expectPlacementsDoNotOverlapEachOther(placements: Array<{ cardId: string; window: TimeWindow }>): void {
  for (let leftIndex = 0; leftIndex < placements.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < placements.length; rightIndex += 1) {
      const left = placements[leftIndex];
      const right = placements[rightIndex];
      expect(
        rangesOverlap(left.window.startAt, left.window.endAt, right.window.startAt, right.window.endAt),
        `${left.cardId} overlaps ${right.cardId}`,
      ).toBe(false);
    }
  }
}

function expectDeadlineSensitiveCardsBeforeSoftCards(
  placements: Array<{ cardId: string }>,
  fixture: ImageTimelineAgentCase,
): void {
  if (!fixture.schedule.expectDeadlineBeforeSoft) return;

  const byId = new Map(fixture.schedule.cards.map((card) => [card.cardId, card]));
  const firstSoftIndex = placements.findIndex((placement) => byId.get(placement.cardId)?.tension === "soft");
  let lastDeadlineSensitiveIndex = -1;
  placements.forEach((placement, index) => {
    if (byId.get(placement.cardId)?.tension === "deadline-sensitive") {
      lastDeadlineSensitiveIndex = index;
    }
  });

  if (firstSoftIndex >= 0 && lastDeadlineSensitiveIndex >= 0) {
    expect(firstSoftIndex).toBeGreaterThan(lastDeadlineSensitiveIndex);
  }
}

function expectOnlyQueueActions(queueActions: QueueAction[]): void {
  expect(queueActions.every((action) => action.actor === "system-service")).toBe(true);
  expect(queueActions.every((action) => action.type === "insert-schedule-event" || action.type === "request-user-review")).toBe(true);
}

function expectForbiddenAuthorityWrites(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toMatch(/committedDeck|cardState|reminderJob|proofRecord|profileSnapshot|hard-lock authority state/);
}

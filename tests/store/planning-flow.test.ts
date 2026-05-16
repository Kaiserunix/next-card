import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCourseDeckInStore, resetNextCardStore, storeState } from "@/tests/helpers/nextCardStore";

const baseNow = new Date("2026-05-16T08:00:00.000Z");

describe("planning store flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetNextCardStore();
  });

  it("records plain text input as text source", () => {
    storeState().setInputText("去高数课");

    expect(storeState().inputs).toMatchObject({
      text: "去高数课",
      sourceType: "text"
    });
  });

  it("turns text into mixed source when a mock attachment already exists", () => {
    storeState().addMockAttachment();
    storeState().setInputText("帮我处理这个通知");

    expect(storeState().inputs.sourceType).toBe("mixed");
    expect(storeState().inputs.parsedText).toContain("课程作业通知");
  });

  it("adds a mock attachment with parsed assignment text", () => {
    storeState().addMockAttachment();

    expect(storeState().inputs.attachments).toHaveLength(1);
    expect(storeState().inputs.attachments[0]).toMatchObject({
      name: "assignment-notice.txt",
      kind: "notice"
    });
    expect(storeState().inputs.parsedText).toContain("今晚 20:00 前提交");
    expect(storeState().inputs.sourceType).toBe("attachment");
  });

  it("adds a mock image schedule with parsed course timetable text", () => {
    storeState().addMockImageSchedule();

    expect(storeState().inputs.imageSchedule).toMatchObject({
      name: "mock-timetable.png"
    });
    expect(storeState().inputs.parsedText).toContain("明天 08:00 高数课");
    expect(storeState().inputs.sourceType).toBe("image");
  });

  it("keeps mixed source when text, attachment, and image coexist", () => {
    storeState().addMockAttachment();
    storeState().addMockImageSchedule();
    storeState().setInputText("把通知和课表一起拆成卡");

    expect(storeState().inputs.sourceType).toBe("mixed");
    expect(storeState().inputs.attachments).toHaveLength(1);
    expect(storeState().inputs.imageSchedule).not.toBeNull();
  });

  it("sets analyzing state without immediately creating options or task flow", () => {
    storeState().setInputText("去高数课");
    storeState().analyzeInput();

    expect(storeState().analysisStatus).toBe("analyzing");
    expect(storeState().analysis?.goalUnderstanding).toContain("出门/到课卡组");
    expect(storeState().plans.options).toEqual([]);
    expect(storeState().taskFlow).toBeNull();
  });

  it("finishes analysis with exactly three unselected plan options", () => {
    storeState().setInputText("去高数课");
    storeState().analyzeInput();
    storeState().finishAnalysis();

    expect(storeState().analysisStatus).toBe("ready");
    expect(storeState().plans.options.map((option) => option.id)).toEqual(["plan-1", "plan-2", "plan-3"]);
    expect(storeState().plans.selectedPlanId).toBeNull();
  });

  it("regenerates options while preserving the original input", () => {
    storeState().setInputText("去高数课");
    storeState().analyzeInput();
    storeState().finishAnalysis();
    storeState().regeneratePlans();

    expect(storeState().inputs.text).toBe("去高数课");
    expect(storeState().plans.options).toHaveLength(3);
    expect(storeState().plans.regenerateCount).toBe(1);
    expect(storeState().plans.options[0].summary).toContain("重新生成");
    expect(storeState().taskFlow).toBeNull();
  });

  it("selecting a valid plan creates task flow, deck, current card, and proof seed", () => {
    const deck = generateCourseDeckInStore();

    expect(storeState().plans.selectedPlanId).toBe("plan-1");
    expect(storeState().taskFlow?.nodes).toHaveLength(4);
    expect(storeState().deck.activeDeckId).toBe(deck.id);
    expect(storeState().deck.currentCardId).toBe(deck.cards[0].id);
    expect(storeState().proofs.records[0]).toMatchObject({
      goalTitle: "去高数课",
      status: "in-progress",
      progress: 0,
      actualMinutes: 0
    });
  });

  it("opens and closes the generated plan catalog overlay without changing the selected plan", () => {
    const deck = generateCourseDeckInStore();
    const state = storeState() as ReturnType<typeof storeState> & {
      activeOverlay: { type: string; id?: string } | null;
      openPlanCatalog: () => void;
      closeOverlay: () => void;
    };

    expect(state.activeOverlay).toBeNull();

    state.openPlanCatalog();

    expect(storeState().plans.selectedPlanId).toBe("plan-1");
    expect((storeState() as typeof state).activeOverlay).toEqual({
      type: "plan-catalog-detail",
      id: deck.id
    });

    (storeState() as typeof state).closeOverlay();

    expect((storeState() as typeof state).activeOverlay).toBeNull();
  });

  it("ignores an invalid plan id without creating deck or proof records", () => {
    storeState().setInputText("去高数课");
    storeState().analyzeInput();
    storeState().finishAnalysis();

    storeState().selectPlan("missing" as "plan-1");

    expect(storeState().deck.decks).toEqual([]);
    expect(storeState().taskFlow).toBeNull();
    expect(storeState().proofs.records).toEqual([]);
  });

  it("ignores an invalid plan id without disturbing an existing generated flow", () => {
    const deck = generateCourseDeckInStore();
    const proofRecordId = storeState().proofs.records[0].id;
    const taskFlowTitle = storeState().taskFlow?.title;

    storeState().selectPlan("missing" as "plan-1");

    expect(storeState().plans.selectedPlanId).toBe("plan-1");
    expect(storeState().taskFlow?.title).toBe(taskFlowTitle);
    expect(storeState().deck.decks).toHaveLength(1);
    expect(storeState().deck.activeDeckId).toBe(deck.id);
    expect(storeState().deck.currentCardId).toBe(deck.cards[0].id);
    expect(storeState().proofs.records).toHaveLength(1);
    expect(storeState().proofs.records[0].id).toBe(proofRecordId);
  });
});

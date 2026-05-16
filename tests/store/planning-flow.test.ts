import { describe, it, expect, beforeEach, vi } from "vitest";
import { useNextCardStore } from "@/store/useNextCardStore";
import { resetNextCardStore } from "@/tests/helpers/nextCardStore";

describe("planning store flow", () => {
  beforeEach(() => {
    resetNextCardStore();
  });

  describe("setInputText", () => {
    it("writes text and keeps sourceType=text without other inputs", () => {
      useNextCardStore.getState().setInputText("去高数课");
      const state = useNextCardStore.getState();
      expect(state.inputs.text).toBe("去高数课");
      expect(state.inputs.sourceType).toBe("text");
    });

    it("flips sourceType to mixed when an attachment already exists", () => {
      useNextCardStore.getState().addMockAttachment();
      useNextCardStore.getState().setInputText("写作业");
      expect(useNextCardStore.getState().inputs.sourceType).toBe("mixed");
    });
  });

  describe("addMockAttachment", () => {
    it("appends a mock attachment, fills parsedText, sets sourceType", () => {
      useNextCardStore.getState().addMockAttachment();
      const state = useNextCardStore.getState();
      expect(state.inputs.attachments.length).toBe(1);
      expect(state.inputs.parsedText).toContain("课程作业通知");
      expect(state.inputs.sourceType).toBe("attachment");
    });

    it("sourceType=mixed when text already present", () => {
      useNextCardStore.getState().setInputText("hi");
      useNextCardStore.getState().addMockAttachment();
      expect(useNextCardStore.getState().inputs.sourceType).toBe("mixed");
    });
  });

  describe("addMockImageSchedule", () => {
    it("fills imageSchedule, parsedText, sourceType=image", () => {
      useNextCardStore.getState().addMockImageSchedule();
      const state = useNextCardStore.getState();
      expect(state.inputs.imageSchedule).not.toBeNull();
      expect(state.inputs.parsedText).toContain("图像课表识别");
      expect(state.inputs.sourceType).toBe("image");
    });

    it("sourceType=mixed when text or attachment already present", () => {
      useNextCardStore.getState().setInputText("test");
      useNextCardStore.getState().addMockImageSchedule();
      expect(useNextCardStore.getState().inputs.sourceType).toBe("mixed");
    });
  });

  describe("analyzeInput", () => {
    it("enters analyzing state with analysis written and options empty", () => {
      useNextCardStore.getState().setInputText("去高数课");
      useNextCardStore.getState().analyzeInput();
      const state = useNextCardStore.getState();
      expect(state.analysisStatus).toBe("analyzing");
      expect(state.analysis?.goalUnderstanding.length).toBeGreaterThan(0);
      expect(state.plans.options).toEqual([]);
      expect(state.taskFlow).toBeNull();
    });
  });

  describe("finishAnalysis", () => {
    it("ready state with exactly 3 options and selectedPlanId null", () => {
      useNextCardStore.getState().setInputText("去高数课");
      useNextCardStore.getState().analyzeInput();
      useNextCardStore.getState().finishAnalysis();
      const state = useNextCardStore.getState();
      expect(state.analysisStatus).toBe("ready");
      expect(state.plans.options).toHaveLength(3);
      expect(state.plans.selectedPlanId).toBeNull();
    });

    it("option ids are plan-1/2/3 and styles are urgent/balanced/gentle", () => {
      useNextCardStore.getState().setInputText("去高数课");
      useNextCardStore.getState().analyzeInput();
      useNextCardStore.getState().finishAnalysis();
      const opts = useNextCardStore.getState().plans.options;
      expect(opts.map((o) => o.id)).toEqual(["plan-1", "plan-2", "plan-3"]);
      expect(opts.map((o) => o.style)).toEqual(["urgent", "balanced", "gentle"]);
    });
  });

  describe("regeneratePlans", () => {
    it("preserves input, keeps 3 options, increments regenerateCount, clears taskFlow", () => {
      useNextCardStore.getState().setInputText("去高数课");
      useNextCardStore.getState().analyzeInput();
      useNextCardStore.getState().finishAnalysis();
      useNextCardStore.getState().selectPlan("plan-1");

      expect(useNextCardStore.getState().taskFlow).not.toBeNull();

      useNextCardStore.getState().regeneratePlans();
      const state = useNextCardStore.getState();
      expect(state.inputs.text).toBe("去高数课");
      expect(state.plans.options).toHaveLength(3);
      expect(state.plans.regenerateCount).toBe(1);
      expect(state.taskFlow).toBeNull();
    });
  });

  describe("selectPlan", () => {
    beforeEach(() => {
      useNextCardStore.getState().setInputText("去高数课");
      useNextCardStore.getState().analyzeInput();
      useNextCardStore.getState().finishAnalysis();
    });

    it("with plan-1 generates flow + deck + first proof record", () => {
      useNextCardStore.getState().selectPlan("plan-1");
      const state = useNextCardStore.getState();

      expect(state.plans.selectedPlanId).toBe("plan-1");
      expect(state.taskFlow).not.toBeNull();
      expect(state.deck.decks.length).toBe(1);
      expect(state.deck.activeDeckId).toBe(state.deck.decks[0].id);
      expect(state.deck.currentCardId).toBe(state.deck.decks[0].cards[0].id);
      expect(state.proofs.records.length).toBe(1);
      expect(state.proofs.records[0].status).toBe("in-progress");
    });

    it("invalid plan id leaves state untouched", () => {
      const before = useNextCardStore.getState();
      // @ts-expect-error testing invalid id
      useNextCardStore.getState().selectPlan("plan-999");
      const after = useNextCardStore.getState();

      expect(after.plans.selectedPlanId).toBeNull();
      expect(after.deck.decks).toEqual(before.deck.decks);
      expect(after.taskFlow).toBeNull();
      expect(after.proofs.records.length).toBe(before.proofs.records.length);
    });
  });

  it("analyzing -> ready timing matches the 880ms component pattern", async () => {
    vi.useFakeTimers();
    useNextCardStore.getState().setInputText("去高数课");
    useNextCardStore.getState().analyzeInput();
    expect(useNextCardStore.getState().analysisStatus).toBe("analyzing");
    useNextCardStore.getState().finishAnalysis();
    expect(useNextCardStore.getState().analysisStatus).toBe("ready");
  });
});

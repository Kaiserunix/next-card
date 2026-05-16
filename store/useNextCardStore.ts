"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  mockAnalyzeInput,
  mockGenerateDeckFromPlan,
  mockGeneratePlanOptions,
  mockGenerateProofSummary,
  mockGenerateTaskFlow,
  mockRegeneratePlanOptions
} from "@/lib/mock-ai";
import type {
  AnalysisResult,
  DeckState,
  InputsState,
  Mode,
  PlanOption,
  PlansState,
  ProofRecord,
  ProofsState,
  TaskFlowState,
  UploadedAttachment,
  UploadedImage
} from "@/lib/types";

type AnalysisStatus = "idle" | "analyzing" | "ready";

type NextCardStore = {
  mode: Mode;
  inputs: InputsState;
  analysis: AnalysisResult | null;
  analysisStatus: AnalysisStatus;
  plans: PlansState;
  taskFlow: TaskFlowState | null;
  deck: DeckState;
  proofs: ProofsState;
  setMode: (mode: Mode) => void;
  setInputText: (text: string) => void;
  addMockAttachment: () => void;
  addMockImageSchedule: () => void;
  analyzeInput: () => void;
  finishAnalysis: () => void;
  regeneratePlans: () => void;
  selectPlan: (planId: PlanOption["id"]) => void;
  openDeck: (deckId: string) => void;
};

const defaultInputs: InputsState = {
  text: "",
  attachments: [],
  imageSchedule: null,
  parsedText: "",
  sourceType: "text"
};

const defaultPlans: PlansState = {
  goalUnderstanding: "",
  constraints: [],
  timeStrategy: [],
  options: [],
  selectedPlanId: null,
  regenerateCount: 0
};

const defaultDeck: DeckState = {
  decks: [],
  activeDeckId: null,
  currentCardId: null,
  completedCardIds: [],
  frozenCardIds: [],
  rewardCards: [],
  rescheduleQueue: [],
  activeTimeMode: "idle"
};

const mockAttachment = (): UploadedAttachment => ({
  id: `attachment-${Date.now()}`,
  name: "assignment-notice.txt",
  kind: "notice",
  mockedText: "课程作业通知：今晚 20:00 前提交一页简短分析，需包含观点、例子和结论。"
});

const mockImage = (): UploadedImage => ({
  id: `image-${Date.now()}`,
  name: "mock-timetable.png",
  parsedTimetable: "图像课表识别：明天 08:00 高数课，地点二教 304，建议提前 20 分钟出门。"
});

export const useNextCardStore = create<NextCardStore>()(
  persist(
    (set, get) => ({
      mode: "input",
      inputs: defaultInputs,
      analysis: null,
      analysisStatus: "idle",
      plans: defaultPlans,
      taskFlow: null,
      deck: defaultDeck,
      proofs: {
        records: [],
        summaryDocument: mockGenerateProofSummary([])
      },
      setMode: (mode) => set({ mode }),
      setInputText: (text) =>
        set((state) => ({
          inputs: {
            ...state.inputs,
            text,
            sourceType:
              state.inputs.attachments.length > 0 || state.inputs.imageSchedule
                ? "mixed"
                : "text"
          }
        })),
      addMockAttachment: () =>
        set((state) => {
          const attachment = mockAttachment();
          return {
            inputs: {
              ...state.inputs,
              attachments: [...state.inputs.attachments, attachment],
              parsedText: [state.inputs.parsedText, attachment.mockedText].filter(Boolean).join("\n"),
              sourceType: state.inputs.text.trim() ? "mixed" : "attachment"
            }
          };
        }),
      addMockImageSchedule: () =>
        set((state) => {
          const imageSchedule = mockImage();
          return {
            inputs: {
              ...state.inputs,
              imageSchedule,
              parsedText: [state.inputs.parsedText, imageSchedule.parsedTimetable].filter(Boolean).join("\n"),
              sourceType: state.inputs.text.trim() || state.inputs.attachments.length > 0 ? "mixed" : "image"
            }
          };
        }),
      analyzeInput: () => {
        const state = get();
        const analysis = mockAnalyzeInput(state.inputs);

        set({
          analysis,
          analysisStatus: "analyzing",
          plans: {
            ...defaultPlans,
            goalUnderstanding: analysis.goalUnderstanding,
            constraints: analysis.constraints,
            timeStrategy: analysis.timeStrategy
          },
          taskFlow: null
        });
      },
      finishAnalysis: () => {
        const state = get();
        const analysis = state.analysis ?? mockAnalyzeInput(state.inputs);
        const options = mockGeneratePlanOptions(analysis);

        set({
          analysis,
          analysisStatus: "ready",
          plans: {
            goalUnderstanding: analysis.goalUnderstanding,
            constraints: analysis.constraints,
            timeStrategy: analysis.timeStrategy,
            options,
            selectedPlanId: null,
            regenerateCount: state.plans.regenerateCount
          }
        });
      },
      regeneratePlans: () => {
        const state = get();
        const analysis = mockAnalyzeInput(state.inputs);
        const options = mockRegeneratePlanOptions(state.inputs, state.plans.options);

        set({
          analysis,
          analysisStatus: "ready",
          plans: {
            goalUnderstanding: analysis.goalUnderstanding,
            constraints: analysis.constraints,
            timeStrategy: analysis.timeStrategy,
            options,
            selectedPlanId: null,
            regenerateCount: state.plans.regenerateCount + 1
          },
          taskFlow: null
        });
      },
      selectPlan: (planId) => {
        const state = get();
        const selected = state.plans.options.find((option) => option.id === planId);

        if (!selected) {
          return;
        }

        const taskFlow = mockGenerateTaskFlow(selected);
        const goalTitle = state.inputs.text.trim() || (state.inputs.imageSchedule ? "去高数课" : "今日推进");
        const generatedDeck = mockGenerateDeckFromPlan(selected, taskFlow, goalTitle);
        const proofRecord: ProofRecord = {
          id: `proof-${Date.now()}`,
          goalTitle: generatedDeck.coverTitle,
          source: state.inputs.sourceType,
          status: "in-progress",
          progress: 0,
          completedCards: 0,
          frozenCards: 0,
          actualMinutes: 0,
          timeStatus: generatedDeck.cards[0]?.urgencyStage === "burning" ? "burning-completed" : "on-time",
          timeDamageEvents:
            generatedDeck.cards[0]?.damageEffect === "burn"
              ? ["生成第一张近截止燃烧演示卡"]
              : ["生成执行卡组"],
          lastDamageEffect: generatedDeck.cards[0]?.damageEffect === "burn" ? "burn" : undefined,
          lastAction: `选择${selected.name}并生成任务流`,
          nextSuggestion: "进入 deck，先完成第一张最小行动卡",
          createdAt: new Date().toISOString()
        };
        const records = [proofRecord, ...state.proofs.records];

        set({
          taskFlow,
          plans: {
            ...state.plans,
            selectedPlanId: planId
          },
          deck: {
            ...state.deck,
            decks: [generatedDeck, ...state.deck.decks.filter((deck) => deck.coverTitle !== generatedDeck.coverTitle)],
            activeDeckId: generatedDeck.id,
            currentCardId: generatedDeck.cards[0]?.id ?? null
          },
          proofs: {
            records,
            summaryDocument: mockGenerateProofSummary(records)
          }
        });
      },
      openDeck: (deckId) =>
        set((state) => {
          const deck = state.deck.decks.find((item) => item.id === deckId);
          return {
            mode: "deck",
            deck: {
              ...state.deck,
              activeDeckId: deckId,
              currentCardId: deck?.cards.find((card) => card.status === "active")?.id ?? deck?.cards[0]?.id ?? null
            }
          };
        })
    }),
    {
      name: "next-card-mvp",
      partialize: (state) => ({
        inputs: state.inputs,
        analysis: state.analysis,
        analysisStatus: state.analysisStatus,
        plans: state.plans,
        taskFlow: state.taskFlow,
        deck: state.deck,
        proofs: state.proofs
      })
    }
  )
);

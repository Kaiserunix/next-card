"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  mockAnalyzeInput,
  mockGenerateDeckFromPlan,
  mockGeneratePlanOptions,
  mockGenerateProofSummary,
  mockGenerateTaskFlow,
  mockRescheduleFrozenCard,
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
  RewardCard,
  TaskCard,
  TaskDeck,
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
  completeCurrentCard: (direction: "left" | "right" | "button") => void;
  freezeCurrentCard: () => void;
  continueCurrentCard: () => void;
  startFocusTiming: () => void;
  startQuickBurning: () => void;
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

const makeProofId = () => `proof-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

const makeRewardId = () => `reward-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

function getActualMinutes(card: TaskCard) {
  const startedSeconds = card.startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(card.startedAt).getTime()) / 1000))
    : 0;
  const seconds = Math.max(card.elapsedSeconds, startedSeconds, Math.round(card.estimatedMinutes * 42));

  return Math.max(1, Math.ceil(seconds / 60));
}

function getNextCardId(cards: TaskCard[], currentIndex: number) {
  return cards.slice(currentIndex + 1).find((card) => card.status === "queued")?.id ?? null;
}

function updateFlowFromCards(taskFlow: TaskFlowState | null, cards: TaskCard[]): TaskFlowState | null {
  if (!taskFlow) {
    return null;
  }

  const completed = cards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
  const overallProgress = cards.length === 0 ? 0 : Math.round((completed / cards.length) * 100);

  return {
    ...taskFlow,
    overallProgress,
    nodes: taskFlow.nodes.map((node) => {
      const nodeCards = cards.filter((card) => card.flowNodeId === node.id);
      const nodeDone = nodeCards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
      const nodeFrozen = nodeCards.some((card) => card.status === "frozen");
      const nodeActive = nodeCards.some((card) => card.status === "active");

      if (nodeCards.length === 0) {
        return node;
      }

      return {
        ...node,
        status: nodeFrozen ? "frozen" : nodeDone === nodeCards.length ? "completed" : nodeActive ? "active" : "not-started",
        progress: Math.round((nodeDone / nodeCards.length) * 100),
        urgencyStage: nodeActive ? nodeCards.find((card) => card.status === "active")?.urgencyStage ?? node.urgencyStage : node.urgencyStage
      };
    })
  };
}

function replaceDeck(decks: TaskDeck[], updatedDeck: TaskDeck) {
  return decks.map((deck) => (deck.id === updatedDeck.id ? updatedDeck : deck));
}

function getDeckProofProgress(deck: TaskDeck, frozenCards = 0) {
  return {
    progress: deck.totalCards === 0 ? 0 : Math.round((deck.completedCards / deck.totalCards) * 100),
    completedCards: deck.completedCards,
    frozenCards
  };
}

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
          id: makeProofId(),
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
        }),
      startFocusTiming: () =>
        set((state) => {
          const activeDeck = state.deck.decks.find((deck) => deck.id === state.deck.activeDeckId);
          const currentCard = activeDeck?.cards.find((card) => card.id === state.deck.currentCardId);

          if (!activeDeck || !currentCard) {
            return state;
          }

          const cards = activeDeck.cards.map((card) =>
            card.id === currentCard.id
              ? {
                  ...card,
                  startedAt: card.startedAt ?? new Date().toISOString(),
                  status: "active" as const
                }
              : card
          );
          const updatedDeck = { ...activeDeck, deckStatus: "active" as const, cards };
          const proofRecord: ProofRecord = {
            id: makeProofId(),
            goalTitle: activeDeck.coverTitle,
            source: state.inputs.sourceType,
            status: "in-progress",
            ...getDeckProofProgress(updatedDeck, state.deck.frozenCardIds.length),
            actualMinutes: 0,
            timeStatus: "on-time",
            timeDamageEvents: ["双击卡片，开始专注计时"],
            lastAction: `开始计时：${currentCard.title}`,
            nextSuggestion: "完成这张卡，或下滑查看状态后选择冻结",
            createdAt: new Date().toISOString()
          };
          const records = [proofRecord, ...state.proofs.records];

          return {
            deck: {
              ...state.deck,
              decks: replaceDeck(state.deck.decks, updatedDeck),
              activeTimeMode: "timing"
            },
            proofs: {
              records,
              summaryDocument: mockGenerateProofSummary(records)
            }
          };
        }),
      startQuickBurning: () =>
        set((state) => {
          const activeDeck = state.deck.decks.find((deck) => deck.id === state.deck.activeDeckId);
          const currentCard = activeDeck?.cards.find((card) => card.id === state.deck.currentCardId);

          if (!activeDeck || !currentCard) {
            return state;
          }

          const cards = activeDeck.cards.map((card) =>
            card.id === currentCard.id
              ? {
                  ...card,
                  startedAt: card.startedAt ?? new Date().toISOString(),
                  urgencyStage: "burning" as const,
                  damageEffect: "burn" as const,
                  damageProgress: Math.max(card.damageProgress, 84),
                  burnLevel: 3 as const,
                  status: "active" as const
                }
              : card
          );
          const updatedDeck = { ...activeDeck, deckStatus: "active" as const, cards };
          const proofRecord: ProofRecord = {
            id: makeProofId(),
            goalTitle: activeDeck.coverTitle,
            source: state.inputs.sourceType,
            status: "in-progress",
            ...getDeckProofProgress(updatedDeck, state.deck.frozenCardIds.length),
            actualMinutes: 0,
            timeStatus: "on-time",
            timeDamageEvents: ["三击进入快速燃烧模式"],
            lastDamageEffect: "burn",
            lastAction: `快速燃烧启动：${currentCard.title}`,
            nextSuggestion: "把燃烧当作提醒，完成最小动作或先冻结",
            createdAt: new Date().toISOString()
          };
          const records = [proofRecord, ...state.proofs.records];

          return {
            deck: {
              ...state.deck,
              decks: replaceDeck(state.deck.decks, updatedDeck),
              activeTimeMode: "burning"
            },
            proofs: {
              records,
              summaryDocument: mockGenerateProofSummary(records)
            }
          };
        }),
      continueCurrentCard: () =>
        set((state) => ({
          deck: {
            ...state.deck,
            activeTimeMode: state.deck.activeTimeMode === "paused" ? "idle" : state.deck.activeTimeMode
          }
        })),
      freezeCurrentCard: () =>
        set((state) => {
          const activeDeck = state.deck.decks.find((deck) => deck.id === state.deck.activeDeckId);
          const currentIndex = activeDeck?.cards.findIndex((card) => card.id === state.deck.currentCardId) ?? -1;
          const currentCard = activeDeck?.cards[currentIndex];

          if (!activeDeck || !currentCard) {
            return state;
          }

          const frozenCard = mockRescheduleFrozenCard(currentCard, state.taskFlow ?? {
            title: activeDeck.coverTitle,
            nodes: [],
            edges: [],
            overallProgress: 0
          });
          const nextCardId = getNextCardId(activeDeck.cards, currentIndex);
          const cards = activeDeck.cards.map((card) => {
            if (card.id === currentCard.id) {
              return frozenCard;
            }

            if (card.id === nextCardId) {
              return { ...card, status: "active" as const };
            }

            return card;
          });
          const frozenCardIds = Array.from(new Set([...state.deck.frozenCardIds, currentCard.id]));
          const updatedDeck: TaskDeck = {
            ...activeDeck,
            deckStatus: nextCardId ? "active" : "frozen",
            cards,
            completedCards: cards.filter((card) => card.status === "completed" || card.status === "rewarded").length
          };
          const proofRecord: ProofRecord = {
            id: makeProofId(),
            goalTitle: activeDeck.coverTitle,
            source: state.inputs.sourceType,
            status: "frozen",
            ...getDeckProofProgress(updatedDeck, frozenCardIds.length),
            actualMinutes: getActualMinutes(currentCard),
            timeStatus: "frozen-rescheduled",
            timeDamageEvents: ["下滑进入冻结提示", "选择先冻结，加入重新安排队列"],
            lastDamageEffect: "freeze",
            lastAction: `冻结：${currentCard.title}`,
            nextSuggestion: "稍后从 reschedule queue 恢复，不需要重新理解目标",
            createdAt: new Date().toISOString()
          };
          const records = [proofRecord, ...state.proofs.records];

          return {
            taskFlow: updateFlowFromCards(state.taskFlow, cards),
            deck: {
              ...state.deck,
              decks: replaceDeck(state.deck.decks, updatedDeck),
              currentCardId: nextCardId,
              frozenCardIds,
              rescheduleQueue: Array.from(new Set([...state.deck.rescheduleQueue, currentCard.id])),
              activeTimeMode: "paused"
            },
            proofs: {
              records,
              summaryDocument: mockGenerateProofSummary(records)
            }
          };
        }),
      completeCurrentCard: (direction) =>
        set((state) => {
          const activeDeck = state.deck.decks.find((deck) => deck.id === state.deck.activeDeckId);
          const currentIndex = activeDeck?.cards.findIndex((card) => card.id === state.deck.currentCardId) ?? -1;
          const currentCard = activeDeck?.cards[currentIndex];

          if (!activeDeck || !currentCard) {
            return state;
          }

          const actualMinutes = getActualMinutes(currentCard);
          const nextCardId = getNextCardId(activeDeck.cards, currentIndex);
          const completedCardIds = Array.from(new Set([...state.deck.completedCardIds, currentCard.id]));
          const wasBurning = state.deck.activeTimeMode === "burning" || currentCard.urgencyStage === "burning";
          const cards = activeDeck.cards.map((card) => {
            if (card.id === currentCard.id) {
              return {
                ...card,
                status: "completed" as const,
                elapsedSeconds: actualMinutes * 60,
                damageProgress: wasBurning ? 100 : card.damageProgress,
                urgencyStage: wasBurning ? "burning" as const : card.urgencyStage
              };
            }

            if (card.id === nextCardId) {
              return { ...card, status: "active" as const };
            }

            return card;
          });
          const completedCount = cards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
          const allDone = completedCount === activeDeck.totalCards;
          const rewardCard: RewardCard | null = allDone
            ? {
                id: makeRewardId(),
                deckId: activeDeck.id,
                title: `${activeDeck.coverTitle} 已变成行动证据`,
                summary: `完成 ${completedCount} 张分解卡，实际投入约 ${cards.reduce((sum, card) => sum + Math.ceil(card.elapsedSeconds / 60), 0)} 分钟。`,
                actualMinutes: cards.reduce((sum, card) => sum + Math.ceil(card.elapsedSeconds / 60), 0),
                timePerformance: wasBurning ? "燃烧模式完成 1 张卡" : `比预计更稳地完成 ${completedCount} 张卡`,
                createdAt: new Date().toISOString()
              }
            : null;
          const updatedDeck: TaskDeck = {
            ...activeDeck,
            deckStatus: allDone ? "completed" : "active",
            cards,
            completedCards: completedCount
          };
          const proofRecord: ProofRecord = {
            id: makeProofId(),
            goalTitle: activeDeck.coverTitle,
            source: state.inputs.sourceType,
            status: allDone ? "rewarded" : "completed",
            ...getDeckProofProgress(updatedDeck, state.deck.frozenCardIds.length),
            actualMinutes,
            timeStatus: wasBurning ? "burning-completed" : "on-time",
            timeDamageEvents: [
              `${direction === "left" ? "左滑" : direction === "right" ? "右滑" : "按钮"}完成卡片`,
              wasBurning ? `快速燃烧 ${actualMinutes} 分钟后完成` : `实际用时 ${actualMinutes} 分钟`
            ],
            lastDamageEffect: wasBurning ? "burn" : undefined,
            lastAction: allDone ? `奖励卡生成：${currentCard.title}` : `完成：${currentCard.title}`,
            nextSuggestion: allDone ? "查看 proof summary，并决定下一组 deck" : "进入下一张卡，保持单卡节奏",
            createdAt: new Date().toISOString()
          };
          const rewardProof: ProofRecord | null = rewardCard
            ? {
                id: makeProofId(),
                goalTitle: activeDeck.coverTitle,
                source: state.inputs.sourceType,
                status: "rewarded",
                progress: 100,
                completedCards: completedCount,
                frozenCards: state.deck.frozenCardIds.length,
                actualMinutes: rewardCard.actualMinutes,
                timeStatus: wasBurning ? "burning-completed" : "on-time",
                timeDamageEvents: ["奖励卡生成", rewardCard.timePerformance],
                lastAction: rewardCard.title,
                nextSuggestion: "把结果写入 proof，稍后复盘最有效的小任务",
                createdAt: rewardCard.createdAt
              }
            : null;
          const records = [rewardProof, proofRecord, ...state.proofs.records].filter(Boolean) as ProofRecord[];

          return {
            taskFlow: updateFlowFromCards(state.taskFlow, cards),
            deck: {
              ...state.deck,
              decks: replaceDeck(state.deck.decks, updatedDeck),
              currentCardId: nextCardId,
              completedCardIds,
              rewardCards: rewardCard ? [rewardCard, ...state.deck.rewardCards] : state.deck.rewardCards,
              activeTimeMode: "idle"
            },
            proofs: {
              records,
              summaryDocument: mockGenerateProofSummary(records)
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

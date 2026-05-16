"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock3,
  Flame,
  Gift,
  Layers3,
  Snowflake,
  Table2,
  Trophy,
  type LucideIcon
} from "lucide-react";
import { PlanCatalogPreview } from "@/components/PlanCatalogPreview";
import type { PlanOption, OverlayType, ProofRecord, TaskCard, TaskDeck, TaskFlowState } from "@/lib/types";
import type { ReactNode } from "react";
import { useNextCardStore } from "@/store/useNextCardStore";

const overlayTitle: Record<OverlayType, { eyebrow: string; title: string }> = {
  guide: { eyebrow: "guide", title: "从目标到证据怎么走" },
  "task-node-detail": { eyebrow: "task node", title: "这一步为什么存在" },
  "plan-catalog-detail": { eyebrow: "plan catalog", title: "计划任务目录" },
  "deck-stack-detail": { eyebrow: "deck stack", title: "未完成卡堆" },
  "deck-card-detail": { eyebrow: "card review", title: "行动卡详情" },
  "evidence-review": { eyebrow: "review", title: "今日证据复盘" },
  "reward-review": { eyebrow: "review", title: "奖励卡复盘" },
  "freeze-review": { eyebrow: "review", title: "冻结重排复盘" },
  "burn-review": { eyebrow: "review", title: "燃烧节奏复盘" },
  "burn-failed-review": { eyebrow: "review", title: "燃烧失败与风险" },
  "frozen-todo-review": { eyebrow: "review", title: "冻结代办复盘" },
  "proof-excel-review": { eyebrow: "table", title: "完成度彩色表" },
  "summary-review": { eyebrow: "summary", title: "完整复盘文档" },
  "proof-record-review": { eyebrow: "proof record", title: "单条证据详情" }
};

export function AppOverlayHost() {
  const { activeOverlay, closeOverlay, taskFlow, plans, proofs, deck, analysis, openDeckCardDetail, openDeckCard } = useNextCardStore();

  if (!activeOverlay) {
    return null;
  }

  const meta = overlayTitle[activeOverlay.type];
  const activeDeck = deck.decks.find((item) => item.id === deck.activeDeckId);
  const selectedPlan = plans.options.find((option) => option.id === plans.selectedPlanId) ?? plans.options[0];

  return (
    <div className="fixed inset-0 z-[80] grid justify-items-center bg-[#fbf1ea]/96 backdrop-blur">
      <section className="flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#fff8f1] px-4 pb-4 pt-[max(env(safe-area-inset-top),0.85rem)] shadow-soft">
        <header className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
          <button
            type="button"
            onClick={closeOverlay}
            className="flex h-10 items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-3 text-sm font-semibold text-ink"
          >
            <ArrowLeft size={16} />
            返回
          </button>
          <div className="min-w-0 text-right">
            <div className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-fern">{meta.eyebrow}</div>
            <h2 className="truncate font-editorial text-[1.45rem] leading-tight text-ink">{meta.title}</h2>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          {activeOverlay.type === "guide" && <GuideContent />}
          {activeOverlay.type === "task-node-detail" && (
            <TaskNodeDetail nodeId={activeOverlay.id} taskFlow={taskFlow} activeDeck={activeDeck} selectedPlan={selectedPlan} />
          )}
          {activeOverlay.type === "plan-catalog-detail" && (
            <PlanCatalogDetail taskFlow={taskFlow} activeDeck={activeDeck} selectedPlan={selectedPlan} onOpenCard={openDeckCardDetail} />
          )}
          {activeOverlay.type === "deck-stack-detail" && <DeckStackReview decks={deck.decks} onOpenCard={openDeckCardDetail} />}
          {activeOverlay.type === "deck-card-detail" && (
            <DeckCardDetail
              decks={deck.decks}
              records={proofs.records}
              taskFlow={taskFlow}
              cardId={activeOverlay.id}
              onFocusCard={openDeckCard}
            />
          )}
          {activeOverlay.type === "evidence-review" && <EvidenceReview records={proofs.records} />}
          {activeOverlay.type === "reward-review" && <RewardReview records={proofs.records} rewardCount={deck.rewardCards.length} />}
          {activeOverlay.type === "freeze-review" && <FrozenTodoReview records={proofs.records} decks={deck.decks} onOpenCard={openDeckCardDetail} />}
          {activeOverlay.type === "burn-review" && <BurnFailedReview records={proofs.records} decks={deck.decks} onOpenCard={openDeckCardDetail} />}
          {activeOverlay.type === "burn-failed-review" && <BurnFailedReview records={proofs.records} decks={deck.decks} onOpenCard={openDeckCardDetail} />}
          {activeOverlay.type === "frozen-todo-review" && <FrozenTodoReview records={proofs.records} decks={deck.decks} onOpenCard={openDeckCardDetail} />}
          {activeOverlay.type === "proof-excel-review" && (
            <ProofExcelReview decks={deck.decks} records={proofs.records} onOpenCard={openDeckCardDetail} />
          )}
          {activeOverlay.type === "summary-review" && <SummaryReview summary={proofs.summaryDocument} analysisTitle={analysis?.goalUnderstanding} />}
          {activeOverlay.type === "proof-record-review" && <ProofRecordReview record={proofs.records.find((item) => item.id === activeOverlay.id)} />}
        </div>
      </section>
    </div>
  );
}

function GuideContent() {
  return (
    <div className="grid gap-3">
      <OverlayCard icon={BookOpen} title="Input：先把模糊目标压成方案">
        输入一句目标后，系统会先用方案一快速拆解；如果节奏不合适，可以在结果页切到方案二或方案三。
      </OverlayCard>
      <OverlayCard icon={Layers3} title="Deck：进入单卡执行">
        点击进入 deck 后，只面对当前最小行动卡。燃烧、冻结、完成都会写入 proof，而不是变成普通 Todo。
      </OverlayCard>
      <OverlayCard icon={Trophy} title="Proof：把行为变成证据">
        proof 首页只保留关键摘要。点击任一模块，可以展开全屏复盘，看完整原因、时间线和下一步。
      </OverlayCard>
    </div>
  );
}

function TaskNodeDetail({
  nodeId,
  taskFlow,
  activeDeck,
  selectedPlan
}: {
  nodeId?: string;
  taskFlow: TaskFlowState | null;
  activeDeck: TaskDeck | undefined;
  selectedPlan: PlanOption | undefined;
}) {
  const node = taskFlow?.nodes.find((item) => item.id === nodeId) ?? taskFlow?.nodes[0];
  const nodeCards = activeDeck?.cards.filter((card) => card.flowNodeId === node?.id).slice(0, 3) ?? [];

  if (!node) {
    return <EmptyOverlay message="还没有可复盘的任务节点。" />;
  }

  return (
    <div className="grid gap-3">
      <OverlayCard icon={Layers3} title={node.title}>
        这个节点是进入行动卡之前的压缩路标，帮助你知道现在推进的是哪一组小任务，而不是重新面对整个目标。
      </OverlayCard>
      <DetailGrid
        items={[
          ["时间压力", node.timeLabel],
          ["当前状态", node.status],
          ["推进度", `${node.progress}%`],
          ["方案节奏", selectedPlan?.name ?? "方案一"]
        ]}
      />
      <OverlaySection title="会生成哪些行动卡">
        {nodeCards.length > 0 ? (
          nodeCards.map((card) => (
            <MiniLine key={card.id} title={card.title} detail={`${card.estimatedMinutes} min · ${card.urgencyStage}`} />
          ))
        ) : (
          <p className="text-sm leading-6 text-ink/64">这个节点暂时没有关联卡片，进入 deck 后会从当前 active card 开始。</p>
        )}
      </OverlaySection>
      <OverlaySection title="方案一/二/三怎么选">
        <MiniLine title="方案一" detail="适合先做最低可交付版本，快进 deck。" />
        <MiniLine title="方案二" detail="适合平衡速度和完整度，任务更稳。" />
        <MiniLine title="方案三" detail="适合低压力推进，给疲惫状态留余地。" />
      </OverlaySection>
    </div>
  );
}

function PlanCatalogDetail({
  taskFlow,
  activeDeck,
  selectedPlan,
  onOpenCard
}: {
  taskFlow: TaskFlowState | null;
  activeDeck: TaskDeck | undefined;
  selectedPlan: PlanOption | undefined;
  onOpenCard: (cardId: string) => void;
}) {
  if (!taskFlow || !activeDeck) {
    return <EmptyOverlay message="还没有可打开的计划目录。" />;
  }

  return (
    <div className="grid gap-3">
      <PlanCatalogPreview
        taskFlow={taskFlow}
        deck={activeDeck}
        selectedPlan={selectedPlan}
        onOpen={() => undefined}
        onNodeOpen={() => undefined}
      />
      <OverlaySection title="计划目录表">
        {taskFlow.nodes.map((node, index) => {
          const cards = activeDeck.cards.filter((card) => card.flowNodeId === node.id);
          const completed = cards.length > 0
            ? cards.every((card) => card.status === "completed" || card.status === "rewarded")
            : node.status === "completed" || node.status === "rewarded";

          return (
            <div key={node.id} className={`rounded-[1rem] px-3 py-3 ${completed ? "bg-ink/[0.035] text-ink/38" : "bg-white/68 text-ink"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] opacity-60">
                    0{index + 1} · {node.timeLabel}
                  </div>
                  <h3 className={`mt-1 text-sm font-semibold leading-5 ${completed ? "line-through" : ""}`}>{node.title}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">{node.progress}%</span>
              </div>
              <div className="mt-2 grid gap-1.5">
                {cards.map((card) => (
                  <CardReviewButton
                    key={card.id}
                    deck={activeDeck}
                    card={card}
                    record={undefined}
                    compact
                    onClick={() => onOpenCard(card.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </OverlaySection>
    </div>
  );
}

function EvidenceReview({ records }: { records: ProofRecord[] }) {
  const completed = records.filter((record) => record.status === "completed" || record.status === "rewarded").length;

  return (
    <ReviewFrame
      icon={Trophy}
      title={`${records.length} 条行动证据`}
      intro={`其中 ${completed} 条进入完成或奖励状态。证据不是打卡数量，而是目标被拆小后留下的行为线索。`}
      records={records.slice(0, 6)}
    />
  );
}

function RewardReview({ records, rewardCount }: { records: ProofRecord[]; rewardCount: number }) {
  const rewarded = records.filter((record) => record.status === "rewarded");

  return (
    <ReviewFrame
      icon={Gift}
      title={`${rewarded.length + rewardCount} 张奖励卡`}
      intro="奖励卡代表一个目标已经从想法变成可读证据。这里适合看完成路径和下一组 deck 的入口。"
      records={rewarded.slice(0, 6)}
    />
  );
}

function FrozenTodoReview({
  records,
  decks,
  onOpenCard
}: {
  records: ProofRecord[];
  decks: TaskDeck[];
  onOpenCard: (cardId: string) => void;
}) {
  const frozen = records.filter((record) => record.status === "frozen" || record.timeStatus === "frozen-rescheduled");
  const frozenCards = decks.flatMap((deck) =>
    deck.cards
      .filter((card) => card.status === "frozen" || card.damageEffect === "freeze")
      .map((card) => ({ deck, card, record: findRecordForCard(records, deck, card) }))
  );

  return (
    <div className="grid gap-3">
      <OverlayCard icon={Snowflake} title={`${frozen.length + frozenCards.length} 个冻结代办`}>
        冻结不是失败，是保存上下文。这里把需要稍后恢复的卡片、冻结原因和下一步建议放在一起。
      </OverlayCard>
      <DetailGrid
        items={[
          ["冻结记录", frozen.length.toString()],
          ["冻结卡片", frozenCards.length.toString()],
          ["恢复队列", frozenCards.filter(({ card }) => card.suggestedStartAt).length.toString()],
          ["最近建议", frozen[0]?.nextSuggestion ?? "继续执行 deck 后生成"]
        ]}
      />
      <OverlaySection title="为什么被冻结">
        <MiniLine title="上下文已保存" detail="卡片不会从 deck 消失，只是变成稍后恢复的代办。" />
        <MiniLine title="任务需要变小" detail="如果冻结次数变多，说明下一轮应该拆得更轻。" />
      </OverlaySection>
      <OverlaySection title="可点击冻结卡片">
        {frozenCards.length > 0 ? (
          frozenCards.map(({ deck, card, record }) => (
            <CardReviewButton key={card.id} deck={deck} card={card} record={record} onClick={() => onOpenCard(card.id)} />
          ))
        ) : (
          <p className="text-sm leading-6 text-ink/64">还没有冻结卡片。下滑卡片并选择“先冻结”后会出现在这里。</p>
        )}
      </OverlaySection>
    </div>
  );
}

function BurnFailedReview({
  records,
  decks,
  onOpenCard
}: {
  records: ProofRecord[];
  decks: TaskDeck[];
  onOpenCard: (cardId: string) => void;
}) {
  const burning = records.filter((record) => record.timeStatus === "burning-completed" || record.lastDamageEffect === "burn");
  const riskyCards = decks.flatMap((deck) =>
    deck.cards
      .filter((card) => card.urgencyStage === "burning" || card.urgencyStage === "expired" || card.damageEffect === "burn")
      .map((card) => ({ deck, card, record: findRecordForCard(records, deck, card) }))
  );

  return (
    <div className="grid gap-3">
      <OverlayCard icon={Flame} title={`${burning.length + riskyCards.length} 条燃烧风险`}>
        燃烧代表行动窗口变窄。这里同时展示已经燃烧完成的记录，以及仍然需要提前安排的风险卡。
      </OverlayCard>
      <DetailGrid
        items={[
          ["燃烧记录", burning.length.toString()],
          ["风险卡片", riskyCards.length.toString()],
          ["已完成", riskyCards.filter(({ card }) => card.status === "completed" || card.status === "rewarded").length.toString()],
          ["下一步", burning[0]?.nextSuggestion ?? "先完成最小动作"]
        ]}
      />
      <OverlaySection title="燃烧原因">
        <MiniLine title="窗口正在收窄" detail="这些卡通常靠近 deadline，或被手动切入快速燃烧。" />
        <MiniLine title="提前安排" detail="如果燃烧卡变多，下一轮适合切到方案二的平衡节奏。" />
      </OverlaySection>
      <OverlaySection title="可点击燃烧卡片">
        {riskyCards.length > 0 ? (
          riskyCards.map(({ deck, card, record }) => (
            <CardReviewButton key={card.id} deck={deck} card={card} record={record} onClick={() => onOpenCard(card.id)} />
          ))
        ) : (
          <p className="text-sm leading-6 text-ink/64">还没有燃烧风险卡片。快速燃烧或近截止卡会在这里出现。</p>
        )}
      </OverlaySection>
    </div>
  );
}

function DeckStackReview({ decks, onOpenCard }: { decks: TaskDeck[]; onOpenCard: (cardId: string) => void }) {
  const unfinished = decks.flatMap((deck) =>
    deck.cards
      .filter((card) => card.status !== "completed" && card.status !== "rewarded")
      .map((card) => ({ deck, card }))
  );
  const groups = [
    {
      title: "进行中",
      cards: unfinished.filter(({ card }) => card.status === "active")
    },
    {
      title: "待办",
      cards: unfinished.filter(({ card }) => card.status === "queued" || card.status === "needs-review")
    },
    {
      title: "冻结",
      cards: unfinished.filter(({ card }) => card.status === "frozen" || card.damageEffect === "freeze")
    },
    {
      title: "燃烧风险",
      cards: unfinished.filter(({ card }) => card.urgencyStage === "burning" || card.urgencyStage === "expired" || card.damageEffect === "burn")
    }
  ];

  return (
    <div className="grid gap-3">
      <OverlayCard icon={Layers3} title={`${unfinished.length} 张未完成卡`}>
        这是 deck 卡堆的全屏详情。完成过的卡片会转移到 proof，这里只保留还需要行动的卡。
      </OverlayCard>
      {groups.map((group) => (
        <OverlaySection key={group.title} title={group.title}>
          {group.cards.length > 0 ? (
            group.cards.map(({ deck, card }) => (
              <CardReviewButton key={`${group.title}-${card.id}`} deck={deck} card={card} onClick={() => onOpenCard(card.id)} />
            ))
          ) : (
            <p className="text-sm leading-6 text-ink/54">暂无{group.title}卡片。</p>
          )}
        </OverlaySection>
      ))}
    </div>
  );
}

function ProofExcelReview({
  decks,
  records,
  onOpenCard
}: {
  decks: TaskDeck[];
  records: ProofRecord[];
  onOpenCard: (cardId: string) => void;
}) {
  const rows = decks.flatMap((deck) => deck.cards.map((card) => ({ deck, card })));
  const completion = rows.length === 0
    ? 0
    : Math.round((rows.filter(({ card }) => card.status === "completed" || card.status === "rewarded").length / rows.length) * 100);

  return (
    <div className="grid gap-3">
      <OverlayCard icon={Table2} title={`${completion}% 完成度`}>
        用颜色像表格一样看每张卡：绿色完成，黄色进行中，蓝色冻结，橙红色代表燃烧失败或超时风险。
      </OverlayCard>
      <DetailGrid
        items={[
          ["目标数", decks.length.toString()],
          ["卡片数", rows.length.toString()],
          ["Proof", records.length.toString()],
          ["完成度", `${completion}%`]
        ]}
      />
      <OverlaySection title="Excel-like 完成度表">
        {rows.map(({ deck, card }) => (
          <ExcelRow
            key={card.id}
            deck={deck}
            card={card}
            record={findRecordForCard(records, deck, card)}
            onClick={() => onOpenCard(card.id)}
          />
        ))}
        {rows.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-ink/56">还没有可展示的卡片。</div>
        )}
      </OverlaySection>
    </div>
  );
}

function SummaryReview({ summary, analysisTitle }: { summary: string; analysisTitle?: string }) {
  return (
    <div className="grid gap-3">
      <OverlayCard icon={BookOpen} title={analysisTitle ?? "今日复盘"}>
        {summary}
      </OverlayCard>
      <OverlaySection title="AI 复盘建议">
        <MiniLine title="下一步" detail="优先选择 10 分钟内能完成的卡，避免重新理解目标。" />
        <MiniLine title="节奏" detail="如果燃烧记录变多，把任务提前进入方案二的平衡节奏。" />
        <MiniLine title="恢复" detail="冻结任务从 reschedule queue 恢复，不需要重写目标。" />
      </OverlaySection>
    </div>
  );
}

function ProofRecordReview({ record }: { record?: ProofRecord }) {
  if (!record) {
    return <EmptyOverlay message="还没有找到这条 proof 记录。" />;
  }

  return (
    <div className="grid gap-3">
      <OverlayCard icon={Clock3} title={record.goalTitle}>
        {record.lastAction}
      </OverlayCard>
      <DetailGrid
        items={[
          ["状态", record.status],
          ["完成度", `${record.progress}%`],
          ["实际用时", `${record.actualMinutes}m`],
          ["时间状态", record.timeStatus]
        ]}
      />
      <OverlaySection title="行动链路">
        {record.timeDamageEvents.map((event) => (
          <MiniLine key={event} title={event} detail={record.nextSuggestion} />
        ))}
      </OverlaySection>
    </div>
  );
}

function DeckCardDetail({
  decks,
  records,
  taskFlow,
  cardId,
  onFocusCard
}: {
  decks: TaskDeck[];
  records: ProofRecord[];
  taskFlow: TaskFlowState | null;
  cardId?: string;
  onFocusCard: (deckId: string, cardId: string) => void;
}) {
  const found = findCardWithDeck(decks, cardId);

  if (!found) {
    return <EmptyOverlay message="没有找到这张行动卡。" />;
  }

  const { deck, card } = found;
  const record = findRecordForCard(records, deck, card);
  const node = taskFlow?.nodes.find((item) => item.id === card.flowNodeId);
  const progress = getCardProgress(card);
  const tone = getCardTone(card);

  return (
    <div className="grid gap-3">
      <article className={`rounded-[1.35rem] p-4 shadow-sm ${tone.rowClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`text-[0.66rem] font-semibold uppercase tracking-[0.18em] ${tone.mutedClass}`}>{deck.coverTitle}</div>
            <h3 className="mt-2 font-editorial text-[1.65rem] leading-tight">{card.title}</h3>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.chipClass}`}>{tone.label}</span>
        </div>
        <p className={`mt-3 text-sm leading-6 ${tone.mutedClass}`}>{card.action}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/26">
          <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
        </div>
      </article>
      <DetailGrid
        items={[
          ["完成度", `${progress}%`],
          ["状态", card.status],
          ["节点", node?.title ?? card.flowNodeId],
          ["时间", `${card.estimatedMinutes}m`]
        ]}
      />
      <OverlaySection title="时间事件">
        {(record?.timeDamageEvents ?? [card.cardBackNote]).map((event) => (
          <MiniLine key={event} title={event} detail={record?.nextSuggestion ?? card.encouragement} />
        ))}
      </OverlaySection>
      <OverlaySection title="下一步建议">
        <MiniLine title="回到 deck" detail={record?.nextSuggestion ?? "把这张卡设为当前卡，继续专注执行。"} />
        <button
          type="button"
          onClick={() => onFocusCard(deck.id, card.id)}
          className="mt-1 flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white"
        >
          在 deck 中打开
          <ArrowRight size={15} />
        </button>
      </OverlaySection>
    </div>
  );
}

function ExcelRow({
  deck,
  card,
  record,
  onClick
}: {
  deck: TaskDeck;
  card: TaskCard;
  record?: ProofRecord;
  onClick: () => void;
}) {
  const tone = getCardTone(card);
  const progress = getCardProgress(card);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[1rem] p-3 text-left shadow-sm ${tone.rowClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`truncate text-[0.64rem] font-semibold uppercase tracking-[0.12em] ${tone.mutedClass}`}>{deck.coverTitle}</div>
          <div className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{card.title}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.chipClass}`}>{progress}%</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <ColorCell label="status" value={card.status} tone={tone} />
        <ColorCell label="actual" value={`${record?.actualMinutes ?? Math.ceil(card.elapsedSeconds / 60)}m`} tone={tone} />
        <ColorCell label="node" value={card.flowNodeId.replace("flow-", "")} tone={tone} />
      </div>
      <p className={`mt-3 line-clamp-2 text-xs leading-5 ${tone.mutedClass}`}>{record?.nextSuggestion ?? card.cardBackNote}</p>
    </button>
  );
}

function ColorCell({ label, value, tone }: { label: string; value: string; tone: ReturnType<typeof getCardTone> }) {
  return (
    <span className={`min-w-0 rounded-[0.75rem] px-2 py-1.5 ${tone.cellClass}`}>
      <span className={`block truncate text-[0.56rem] font-semibold uppercase tracking-[0.08em] ${tone.mutedClass}`}>{label}</span>
      <span className="mt-0.5 block truncate text-xs font-semibold">{value}</span>
    </span>
  );
}

function getCardProgress(card: TaskCard) {
  if (card.status === "completed" || card.status === "rewarded") {
    return 100;
  }

  if (card.status === "frozen") {
    return Math.max(20, card.damageProgress);
  }

  if (card.status === "active") {
    return Math.max(35, card.damageProgress);
  }

  return Math.max(0, card.damageProgress);
}

function getCardTone(card: TaskCard) {
  if (card.status === "completed" || card.status === "rewarded") {
    return {
      label: "完成",
      rowClass: "bg-emerald-700 text-white",
      chipClass: "bg-white/20 text-white",
      cellClass: "bg-white/10",
      mutedClass: "text-white/70"
    };
  }

  if (card.status === "frozen" || card.damageEffect === "freeze") {
    return {
      label: "冻结",
      rowClass: "bg-[#cdebf0] text-sky-950",
      chipClass: "bg-white/50 text-sky-950",
      cellClass: "bg-white/30",
      mutedClass: "text-sky-950/60"
    };
  }

  if (card.urgencyStage === "burning" || card.urgencyStage === "expired" || card.damageEffect === "burn") {
    return {
      label: "燃烧",
      rowClass: "bg-[#e7784b] text-white",
      chipClass: "bg-white/20 text-white",
      cellClass: "bg-white/10",
      mutedClass: "text-white/70"
    };
  }

  if (card.status === "active") {
    return {
      label: "进行中",
      rowClass: "bg-[#ffe08a] text-ink",
      chipClass: "bg-white/50 text-ink",
      cellClass: "bg-white/30",
      mutedClass: "text-ink/60"
    };
  }

  return {
    label: "待办",
    rowClass: "bg-[#edf5ef] text-ink",
    chipClass: "bg-white/60 text-ink",
    cellClass: "bg-white/40",
    mutedClass: "text-ink/50"
  };
}

function findCardWithDeck(decks: TaskDeck[], cardId?: string) {
  if (!cardId) {
    return null;
  }

  for (const deck of decks) {
    const card = deck.cards.find((item) => item.id === cardId);

    if (card) {
      return { deck, card };
    }
  }

  return null;
}

function findRecordForCard(records: ProofRecord[], deck: TaskDeck, card: TaskCard) {
  return records.find((record) =>
    record.goalTitle === deck.coverTitle &&
    (record.lastAction.includes(card.title) || record.timeDamageEvents.some((event) => event.includes(card.title)))
  );
}

function CardReviewButton({
  deck,
  card,
  record,
  compact = false,
  onClick
}: {
  deck: TaskDeck;
  card: TaskCard;
  record?: ProofRecord;
  compact?: boolean;
  onClick: () => void;
}) {
  const tone = getCardTone(card);
  const progress = getCardProgress(card);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[1rem] text-left shadow-sm ${tone.rowClass} ${compact ? "px-3 py-2" : "p-3"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`truncate text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${tone.mutedClass}`}>{deck.coverTitle}</div>
          <div className={`mt-1 truncate text-sm font-semibold ${card.status === "completed" || card.status === "rewarded" ? "line-through opacity-70" : ""}`}>
            {card.title}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.chipClass}`}>{progress}%</span>
      </div>
      {!compact && (
        <p className={`mt-2 line-clamp-2 text-xs leading-5 ${tone.mutedClass}`}>{record?.nextSuggestion ?? card.cardBackNote}</p>
      )}
    </button>
  );
}

function ReviewFrame({
  icon: Icon,
  title,
  intro,
  records
}: {
  icon: LucideIcon;
  title: string;
  intro: string;
  records: ProofRecord[];
}) {
  return (
    <div className="grid gap-3">
      <OverlayCard icon={Icon} title={title}>
        {intro}
      </OverlayCard>
      <OverlaySection title="最近记录">
        {records.length > 0 ? (
          records.map((record) => (
            <MiniLine key={record.id} title={record.lastAction} detail={`${record.status} · ${record.actualMinutes}m`} />
          ))
        ) : (
          <p className="text-sm leading-6 text-ink/64">还没有对应记录。继续执行 deck 后，这里会自动形成复盘内容。</p>
        )}
      </OverlaySection>
    </div>
  );
}

function OverlayCard({
  icon: Icon,
  title,
  children
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[1.35rem] border border-ink/10 bg-white/70 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="font-editorial text-[1.45rem] leading-tight text-ink">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink/68">{children}</p>
        </div>
      </div>
    </article>
  );
}

function OverlaySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.25rem] border border-ink/10 bg-white/56 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-fern">{title}</h3>
      <div className="mt-3 grid gap-2">{children}</div>
    </section>
  );
}

function DetailGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-[1rem] bg-white/66 px-3 py-3">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/38">{label}</div>
          <div className="mt-1 truncate text-sm font-semibold text-ink">{value}</div>
        </div>
      ))}
    </div>
  );
}

function MiniLine({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[1rem] bg-ink/[0.045] px-3 py-2">
      <div className="text-sm font-semibold leading-5 text-ink">{title}</div>
      <div className="mt-1 text-xs leading-5 text-ink/58">{detail}</div>
    </div>
  );
}

function EmptyOverlay({ message }: { message: string }) {
  return <div className="rounded-[1rem] bg-white/70 px-4 py-10 text-center text-sm text-ink/58">{message}</div>;
}

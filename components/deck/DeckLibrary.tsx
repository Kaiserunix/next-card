"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronRight, Flame, Layers3, PanelRightClose, PanelRightOpen, Snowflake, Target } from "lucide-react";
import type { ComponentType } from "react";
import type { TaskCard, TaskDeck } from "@/lib/types";
import { useNextCardStore } from "@/store/useNextCardStore";
import { RewardCard } from "@/components/deck/RewardCard";
import { SwipeTaskCard } from "@/components/deck/SwipeTaskCard";

type DeckStackItem = {
  deck: TaskDeck;
  remaining: number;
  frozen: number;
  burning: number;
  activeTitle: string;
};

export function DeckLibrary() {
  const {
    deck,
    deckPanelOpen,
    focusCardMode,
    openDeck,
    openDeckPanel,
    closeDeckPanel,
    toggleFocusCardMode
  } = useNextCardStore();
  const activeDeck = deck.decks.find((item) => item.id === deck.activeDeckId) ?? deck.decks[0];
  const activeCard = getActiveCard(activeDeck, deck.currentCardId);
  const latestReward = activeDeck
    ? deck.rewardCards.find((reward) => reward.deckId === activeDeck.id)
    : null;
  const stackItems = deck.decks.map(toStackItem).filter((item) => item.remaining > 0);
  const remainingCount = stackItems.reduce((sum, item) => sum + item.remaining, 0);
  const frozenCount = stackItems.reduce((sum, item) => sum + item.frozen, 0);
  const burningCount = stackItems.reduce((sum, item) => sum + item.burning, 0);

  if (deck.decks.length === 0) {
    return (
      <section className="phone-shell grain flex h-full min-h-0 flex-col items-center justify-center overflow-hidden p-6 text-center shadow-soft">
        <Layers3 className="relative z-10 text-ink/42" size={34} />
        <h2 className="relative z-10 mt-4 font-editorial text-[1.85rem] text-ink">还没有 deck</h2>
        <p className="relative z-10 mx-auto mt-2 max-w-[18rem] text-sm leading-6 text-ink/60">
          先到 input 生成方案，deck 会变成一张专注行动卡。
        </p>
      </section>
    );
  }

  return (
    <section className="phone-shell grain relative flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-4 pt-4">
      <header className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-fern">
            <Target size={14} />
            focus deck
          </div>
          <h1 className="mt-1 truncate font-editorial text-[1.78rem] leading-tight text-ink">
            {activeDeck?.coverTitle ?? "单卡专注"}
          </h1>
        </div>
        <button
          type="button"
          onClick={toggleFocusCardMode}
          className={`h-9 shrink-0 rounded-full px-3 text-xs font-semibold transition ${
            focusCardMode ? "bg-ink text-white" : "border border-ink/10 bg-white/64 text-ink"
          }`}
          aria-pressed={focusCardMode}
        >
          专注
        </button>
      </header>

      <div className="relative z-10 mt-3 min-h-0 flex-1 overflow-hidden pr-10">
        {activeDeck && activeCard ? (
          <SwipeTaskCard deck={activeDeck} card={activeCard} focus={focusCardMode} />
        ) : activeDeck?.deckStatus === "completed" && latestReward ? (
          <div className="flex h-full min-h-0 items-center">
            <RewardCard reward={latestReward} />
          </div>
        ) : (
          <div className="grid h-full min-h-0 place-items-center rounded-[1.5rem] border border-ink/10 bg-white/56 px-5 text-center text-sm leading-6 text-ink/58">
            这一组已经没有可执行卡片，完成证据已进入 proof。
          </div>
        )}

        <DeckStackButton
          open={deckPanelOpen}
          remainingCount={remainingCount}
          frozenCount={frozenCount}
          burningCount={burningCount}
          onClick={deckPanelOpen ? closeDeckPanel : openDeckPanel}
        />

        <AnimatePresence>
          {deckPanelOpen && (
            <StackSidePanel
              activeDeckId={activeDeck?.id}
              items={stackItems}
              onClose={closeDeckPanel}
              onSelect={openDeck}
            />
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function getActiveCard(deck: TaskDeck | undefined, currentCardId: string | null): TaskCard | undefined {
  if (!deck) {
    return undefined;
  }

  return (
    deck.cards.find((card) => card.id === currentCardId) ??
    deck.cards.find((card) => card.status === "active") ??
    deck.cards.find((card) => card.status === "queued")
  );
}

function toStackItem(deck: TaskDeck): DeckStackItem {
  const unfinished = deck.cards.filter((card) => card.status !== "completed" && card.status !== "rewarded");
  const active = unfinished.find((card) => card.status === "active") ?? unfinished[0];

  return {
    deck,
    remaining: unfinished.length,
    frozen: unfinished.filter((card) => card.status === "frozen").length,
    burning: unfinished.filter((card) => card.urgencyStage === "burning" || card.damageEffect === "burn").length,
    activeTitle: active?.title ?? "已完成"
  };
}

function DeckStackButton({
  open,
  remainingCount,
  frozenCount,
  burningCount,
  onClick
}: {
  open: boolean;
  remainingCount: number;
  frozenCount: number;
  burningCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="deck-stack-tool absolute right-0 top-1/2 z-20 flex w-11 -translate-y-1/2 flex-col items-center gap-2 rounded-l-[1.25rem] border border-ink/10 bg-[#fff8f1]/92 px-1.5 py-3 text-ink shadow-card backdrop-blur transition hover:-translate-y-[51%]"
      aria-expanded={open}
      aria-label="展开未完成卡堆"
    >
      {open ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
      <span className="grid size-8 place-items-center rounded-[0.75rem] bg-ink text-sm font-semibold text-white">
        {remainingCount}
      </span>
      <StackMiniMetric icon={Snowflake} value={frozenCount} />
      <StackMiniMetric icon={Flame} value={burningCount} />
    </button>
  );
}

function StackMiniMetric({
  icon: Icon,
  value
}: {
  icon: ComponentType<{ size?: number }>;
  value: number;
}) {
  return (
    <span className="flex flex-col items-center gap-0.5 text-[0.62rem] font-semibold text-ink/62">
      <Icon size={12} />
      {value}
    </span>
  );
}

function StackSidePanel({
  activeDeckId,
  items,
  onClose,
  onSelect
}: {
  activeDeckId?: string;
  items: DeckStackItem[];
  onClose: () => void;
  onSelect: (deckId: string) => void;
}) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 42 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 42 }}
      transition={{ type: "spring", stiffness: 360, damping: 34 }}
      className="absolute inset-y-0 right-0 z-30 flex w-[82%] max-w-[20rem] flex-col rounded-l-[1.55rem] border border-ink/10 bg-[#fff8f1]/96 p-3 shadow-[0_20px_55px_rgba(43,32,24,0.24)] backdrop-blur"
    >
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <div>
          <div className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-fern">unfinished stack</div>
          <h2 className="font-editorial text-[1.45rem] leading-tight text-ink">未完成卡堆</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full border border-ink/10 bg-white/70 text-ink"
          aria-label="关闭未完成卡堆"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        <div className="grid gap-2">
          {items.map((item) => {
            const selected = item.deck.id === activeDeckId;

            return (
              <button
                key={item.deck.id}
                type="button"
                onClick={() => onSelect(item.deck.id)}
                className={`rounded-[1.15rem] border p-3 text-left transition ${
                  selected ? "border-ink/20 bg-ink text-white" : "border-ink/10 bg-white/66 text-ink hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{item.deck.coverTitle}</h3>
                    <p className={`mt-1 line-clamp-2 text-xs leading-5 ${selected ? "text-white/68" : "text-ink/58"}`}>
                      {item.activeTitle}
                    </p>
                  </div>
                  <ChevronRight size={15} className="mt-0.5 shrink-0" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <PanelMetric label="剩余" value={item.remaining.toString()} selected={selected} />
                  <PanelMetric label="冻结" value={item.frozen.toString()} selected={selected} />
                  <PanelMetric label="燃烧" value={item.burning.toString()} selected={selected} />
                </div>
              </button>
            );
          })}
          {items.length === 0 && (
            <div className="rounded-[1rem] bg-white/70 px-4 py-8 text-center text-sm leading-6 text-ink/58">
              没有未完成卡片。完成证据已经保存到 proof。
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-ink/10 pt-3 text-center text-xs font-semibold text-ink/58">
        <div className="rounded-[0.9rem] bg-white/62 px-2 py-2">
          <BookOpen className="mx-auto mb-1" size={13} />
          切卡组
        </div>
        <div className="rounded-[0.9rem] bg-[#eefbff] px-2 py-2 text-sky-900">
          <Snowflake className="mx-auto mb-1" size={13} />
          可恢复
        </div>
        <div className="rounded-[0.9rem] bg-[#fff3ea] px-2 py-2 text-ember">
          <Flame className="mx-auto mb-1" size={13} />
          有风险
        </div>
      </div>
    </motion.aside>
  );
}

function PanelMetric({ label, value, selected }: { label: string; value: string; selected: boolean }) {
  return (
    <div className={`rounded-[0.75rem] px-2 py-1.5 ${selected ? "bg-white/12" : "bg-ink/[0.045]"}`}>
      <div className={`truncate text-[0.58rem] font-semibold uppercase tracking-[0.06em] ${selected ? "text-white/42" : "text-ink/36"}`}>
        {label}
      </div>
      <div className={`mt-0.5 text-xs font-semibold ${selected ? "text-white" : "text-ink/72"}`}>{value}</div>
    </div>
  );
}

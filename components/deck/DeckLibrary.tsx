"use client";

import { Flame, Layers3, PanelRightOpen, Snowflake, Target } from "lucide-react";
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
};

export function DeckLibrary() {
  const {
    deck,
    focusCardMode,
    toggleFocusCardMode,
    openOverlay,
    openPlanCatalog
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
  const progress = activeDeck && activeDeck.totalCards > 0 ? Math.round((activeDeck.completedCards / activeDeck.totalCards) * 100) : 0;

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
            Deck library
          </div>
          <h1 className="mt-1 truncate font-editorial text-[1.78rem] leading-tight text-ink">
            {activeDeck?.coverTitle ?? "单卡专注"}
          </h1>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink/42">Active card</div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={openPlanCatalog}
            className="h-9 rounded-full border border-ink/10 bg-white/64 px-3 text-xs font-semibold text-ink"
          >
            计划栏
          </button>
          <button
            type="button"
            onClick={toggleFocusCardMode}
            className={`h-9 rounded-full px-3 text-xs font-semibold transition ${
              focusCardMode ? "bg-ink text-white" : "border border-ink/10 bg-white/64 text-ink"
            }`}
            aria-pressed={focusCardMode}
          >
            专注
          </button>
        </div>
      </header>

      <div className={`relative z-10 mt-3 min-h-0 flex-1 overflow-hidden ${focusCardMode ? "pr-10" : ""}`}>
        <div className={focusCardMode ? "h-full min-h-0" : "flex h-full min-h-0 flex-col gap-3"}>
          <div className="min-h-0 flex-1">
            {activeDeck && activeCard ? (
              <SwipeTaskCard deck={activeDeck} card={activeCard} focus />
            ) : activeDeck?.deckStatus === "completed" && latestReward ? (
              <div className="flex h-full min-h-0 items-center">
                <RewardCard reward={latestReward} />
              </div>
            ) : (
              <div className="grid h-full min-h-0 place-items-center rounded-[1.5rem] border border-ink/10 bg-white/56 px-5 text-center text-sm leading-6 text-ink/58">
                这一组已经没有可执行卡片，完成证据已进入 proof。
              </div>
            )}
          </div>

          {!focusCardMode && (
            <DeckStackTray
              remainingCount={remainingCount}
              frozenCount={frozenCount}
              burningCount={burningCount}
              progress={progress}
              onClick={() => openOverlay("deck-stack-detail")}
            />
          )}
        </div>

        {focusCardMode && (
          <DeckStackButton
            remainingCount={remainingCount}
            frozenCount={frozenCount}
            burningCount={burningCount}
            onClick={() => openOverlay("deck-stack-detail")}
          />
        )}

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

  return {
    deck,
    remaining: unfinished.length,
    frozen: unfinished.filter((card) => card.status === "frozen").length,
    burning: unfinished.filter((card) => card.urgencyStage === "burning" || card.damageEffect === "burn").length
  };
}

function DeckStackButton({
  remainingCount,
  frozenCount,
  burningCount,
  onClick
}: {
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
      aria-label="展开未完成卡堆"
    >
      <PanelRightOpen size={16} />
      <span className="grid size-8 place-items-center rounded-[0.75rem] bg-ink text-sm font-semibold text-white">
        {remainingCount}
      </span>
      <StackMiniMetric icon={Snowflake} value={frozenCount} />
      <StackMiniMetric icon={Flame} value={burningCount} />
    </button>
  );
}

function DeckStackTray({
  remainingCount,
  frozenCount,
  burningCount,
  progress,
  onClick
}: {
  remainingCount: number;
  frozenCount: number;
  burningCount: number;
  progress: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="stacked-cover relative h-[5.15rem] shrink-0 overflow-hidden rounded-[1.25rem] border border-ink/10 bg-[#fff0b8] px-4 py-3 text-left shadow-card"
      aria-label="展开未完成卡堆"
    >
      <div className="relative z-10 flex h-full items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink/48">unfinished stack</div>
          <div className="mt-1 truncate font-editorial text-[1.25rem] leading-tight text-ink">未完成卡堆</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/72">
            <div className="h-full rounded-full bg-ink" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[0.66rem] font-semibold text-ink">
          <TrayMetric label="剩余" value={remainingCount} />
          <TrayMetric label="冻结" value={frozenCount} />
          <TrayMetric label="燃烧" value={burningCount} />
        </div>
      </div>
    </button>
  );
}

function TrayMetric({ label, value }: { label: string; value: number }) {
  return (
    <span className="grid size-11 place-items-center rounded-[0.85rem] bg-white/68">
      <span>
        <span className="block text-sm leading-none">{value}</span>
        <span className="mt-1 block text-[0.56rem] text-ink/46">{label}</span>
      </span>
    </span>
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
    <span className="flex flex-col items-center gap-0.5 text-[0.62rem] font-semibold text-ink/60">
      <Icon size={12} />
      {value}
    </span>
  );
}
